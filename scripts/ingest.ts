#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { GitRepository } from './lib/git.js';
import { collectHistory } from './lib/history.js';
import { deriveTitle, slugify } from './lib/filename-parser.js';
import { languageInfo } from './lib/language.js';
import { hash } from './lib/hashing.js';
import {
  fallbackNarrative,
  narrativePrompt,
  shouldRequestLlm,
  validateNarrative,
} from './lib/narrative.js';
import { OpenRouterClient } from './lib/openrouter.js';
import { readManifest, writeStable } from './lib/manifest.js';
import {
  SCHEMA_VERSION,
  PARSER_VERSION,
  PROMPT_VERSION,
  problemPageSchema,
  indexSchema,
  errorsSchema,
  siteSchema,
  type BuildManifest,
  type GeneratedPage,
  type GeneratedIndex,
  type NarrativeResult,
} from './lib/schemas.js';
function args(argv: string[]) {
  const get = (flag: string) => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  return {
    source: get('--source'),
    full: argv.includes('--full'),
    dryRun: argv.includes('--dry-run'),
    noLlm: argv.includes('--no-llm'),
    problem: get('--problem'),
    language: get('--language'),
    verbose: argv.includes('--verbose'),
  };
}
async function main() {
  const flags = args(process.argv.slice(2));
  if (!flags.source)
    throw new Error('Missing --source <path> (a full Git clone)');
  const root = process.cwd();
  const source = path.resolve(flags.source);
  try {
    if (!(await fs.stat(source)).isDirectory()) throw new Error();
  } catch {
    throw new Error(
      `Source path does not exist or is not a directory: ${source}`,
    );
  }
  const site = siteSchema.parse(
    JSON.parse(await fs.readFile(path.join(root, 'config/site.json'), 'utf8')),
  );
  const git = new GitRepository(source);
  const head = await git.verify();
  const old = await readManifest(root);
  const rewritten =
    Boolean(old?.sourceHeadSha) &&
    !(await git.isAncestor(old!.sourceHeadSha!, head));
  if (rewritten)
    console.warn(
      '[git] Previous HEAD is not an ancestor; performing full re-index',
    );
  const history = await collectHistory(git);
  const client = new OpenRouterClient();
  const pages: GeneratedPage[] = [];
  let cacheHits = 0,
    regenerated = 0;
  for (const [key, revisions] of [...history.groups].sort()) {
    const [idText, language] = key.split('/') as [string, string];
    const problemId = Number(idText);
    if (
      (flags.problem && problemId !== Number(flags.problem)) ||
      (flags.language && language !== flags.language)
    )
      continue;
    const latest = revisions.at(-1)!;
    const title = deriveTitle(latest.sourceFilename, problemId);
    const inputHash = hash({
      problemId,
      language,
      title,
      revisions: revisions.map((r) => ({
        sha: r.sha,
        codeHash: r.codeHash,
        subject: r.rawCommitSubject,
        body: r.commitBody,
        diff: r.diffFromPreviousRelevantRevision,
      })),
    });
    const oldMeta = old?.groups[key];
    let narrative: NarrativeResult | undefined;
    let status: 'llm' | 'cached' | 'fallback' | 'stale' = 'fallback';
    let model: string | null = null;
    try {
      const existingPath = path.join(
        root,
        'generated/problems',
        String(problemId),
        `${language}.json`,
      );
      const existing = problemPageSchema.parse(
        JSON.parse(await fs.readFile(existingPath, 'utf8')),
      );
      if (
        oldMeta?.inputHash === inputHash &&
        oldMeta.promptVersion === PROMPT_VERSION
      ) {
        narrative = {
          approaches: existing.approaches.map((a) => ({
            id: a.id,
            title: a.title,
            summary: a.summary,
            order: a.order,
            revisions: a.revisions.map((r) => ({
              sha: r.sha,
              order: r.narrativeIndex,
              shortChange: r.shortChangeSummary,
            })),
          })),
        };
        status = 'cached';
        model = existing.analysis.model;
        cacheHits++;
      }
    } catch {}
    if (
      !narrative &&
      shouldRequestLlm(revisions.length) &&
      !flags.noLlm &&
      process.env.OPENROUTER_API_KEY &&
      process.env.OPENROUTER_MODEL
    ) {
      try {
        narrative = validateNarrative(
          await client.generate(
            narrativePrompt(problemId, title, language, revisions),
          ),
          revisions.map((r) => r.sha),
        );
        status = 'llm';
        model = process.env.OPENROUTER_MODEL;
      } catch (e) {
        console.warn(
          `[llm] ${key}: ${e instanceof Error ? e.message : String(e)}; using fallback`,
        );
      }
    }
    if (!narrative) narrative = fallbackNarrative(revisions);
    const bySha = new Map(revisions.map((r) => [r.sha, r]));
    const approaches = narrative.approaches
      .sort((a, b) => a.order - b.order)
      .map((a, ai) => ({
        id: a.id,
        title: a.title,
        summary: a.summary,
        order: ai,
        revisions: a.revisions
          .sort((x, y) => x.order - y.order)
          .map((n, ri) => ({
            ...bySha.get(n.sha)!,
            approachId: a.id,
            narrativeIndex: ri,
            shortChangeSummary: n.shortChange,
          })),
      }));
    const dates = revisions.map((r) => r.committedAt);
    const info = languageInfo[language] ?? {
      label: language,
      shikiLanguage: 'text',
    };
    const page: GeneratedPage = {
      schemaVersion: SCHEMA_VERSION,
      problem: { id: problemId, title, slug: slugify(title) },
      language: {
        id: language,
        label: info.label,
        shikiLanguage: info.shikiLanguage,
      },
      source: {
        repositoryUrl: site.sourceRepositoryUrl,
        latestPath: latest.sourcePath,
        latestSha: latest.sha,
        deleted: history.deleted.has(key),
      },
      statistics: {
        revisionCount: revisions.length,
        approachCount: approaches.length,
        incorrectRevisionCount: revisions.filter((r) => r.markedWrong).length,
        firstCommittedAt: dates[0] ?? null,
        lastCommittedAt: dates.at(-1) ?? null,
      },
      analysis: { status, model, promptVersion: PROMPT_VERSION, inputHash },
      approaches,
      chronologicalRevisionShas: revisions.map((r) => r.sha),
      warnings: revisions.flatMap((r) => r.warnings),
    };
    problemPageSchema.parse(page);
    pages.push(page);
    regenerated++;
  }
  const questionMap = new Map<number, GeneratedIndex['questions'][number]>();
  for (const p of pages) {
    let q = questionMap.get(p.problem.id);
    if (!q) {
      q = {
        id: p.problem.id,
        title: p.problem.title,
        slug: p.problem.slug,
        languages: [],
        firstCommittedAt: p.statistics.firstCommittedAt,
        lastCommittedAt: p.statistics.lastCommittedAt,
      };
      questionMap.set(p.problem.id, q);
    }
    if ((p.statistics.lastCommittedAt ?? '') > (q.lastCommittedAt ?? '')) {
      q.title = p.problem.title;
      q.slug = p.problem.slug;
      q.lastCommittedAt = p.statistics.lastCommittedAt;
    }
    if ((p.statistics.firstCommittedAt ?? '') < (q.firstCommittedAt ?? '~'))
      q.firstCommittedAt = p.statistics.firstCommittedAt;
    q.languages.push({
      id: p.language.id,
      label: p.language.label,
      route: `/problems/${p.problem.id}/${p.language.id}/`,
      revisionCount: p.statistics.revisionCount,
      approachCount: p.statistics.approachCount,
      incorrectRevisionCount: p.statistics.incorrectRevisionCount,
      lastCommittedAt: p.statistics.lastCommittedAt,
    });
  }
  const now = new Date().toISOString();
  const index: GeneratedIndex = {
    schemaVersion: SCHEMA_VERSION,
    generatedAt: now,
    sourceHeadSha: head,
    questions: [...questionMap.values()].sort((a, b) => a.id - b.id),
  };
  indexSchema.parse(index);
  const groups: BuildManifest['groups'] = {};
  for (const p of pages)
    groups[`${p.problem.id}/${p.language.id}`] = {
      problemId: p.problem.id,
      language: p.language.id,
      inputHash: p.analysis.inputHash,
      outputPath: `generated/problems/${p.problem.id}/${p.language.id}.json`,
      promptVersion: PROMPT_VERSION,
      model: p.analysis.model,
      analysisStatus: p.analysis.status,
      updatedAt: now,
    };
  const processedCommits: BuildManifest['processedCommits'] = {};
  for (const c of history.commits)
    processedCommits[c.sha] = {
      contentHash: hash({
        subject: c.rawSubject,
        body: c.rawBody,
        files: c.changedFiles,
      }),
      affectedGroups: [...history.groups]
        .filter(([, rs]) => rs.some((r) => r.sha === c.sha))
        .map(([k]) => k),
      processedAt: now,
    };
  const manifest: BuildManifest = {
    schemaVersion: SCHEMA_VERSION,
    sourceRepository: site.sourceRepositoryUrl,
    sourceHeadSha: head,
    generatedAt: now,
    parserVersion: PARSER_VERSION,
    promptVersion: PROMPT_VERSION,
    processedCommits,
    groups,
  };
  if (!flags.dryRun) {
    for (const p of pages)
      await writeStable(
        path.join(
          root,
          'generated/problems',
          String(p.problem.id),
          `${p.language.id}.json`,
        ),
        p,
      );
    await writeStable(path.join(root, 'generated/index.json'), index);
    await writeStable(path.join(root, 'generated/manifest.json'), manifest);
    await writeStable(
      path.join(root, 'generated/ingestion-errors.json'),
      errorsSchema.parse({
        schemaVersion: SCHEMA_VERSION,
        warnings: history.warnings,
        errors: [],
      }),
    );
    if (flags.full || rewritten) {
      const expected = new Set(
        pages.map((p) =>
          path.join(
            root,
            'generated/problems',
            String(p.problem.id),
            `${p.language.id}.json`,
          ),
        ),
      );
      for (const file of await listJson(path.join(root, 'generated/problems')))
        if (!expected.has(file)) await fs.unlink(file);
    }
  }
  console.log(
    `[done] ${history.commits.length} commits parsed, ${pages.length} groups processed, ${regenerated} regenerated, ${client.calls.count} LLM calls, ${cacheHits} cache hits, ${history.warnings.length} warnings; HEAD ${head}`,
  );
}
async function listJson(dir: string): Promise<string[]> {
  try {
    const out: string[] = [];
    for (const e of await fs.readdir(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) out.push(...(await listJson(p)));
      else if (e.name.endsWith('.json')) out.push(p);
    }
    return out;
  } catch {
    return [];
  }
}
main().catch((e) => {
  console.error(`[error] ${e instanceof Error ? e.message : String(e)}`);
  process.exitCode = 1;
});
