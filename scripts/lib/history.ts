import path from 'node:path';
import { GitRepository } from './git.js';
import { parseCommitSubject } from './commit-parser.js';
import { inferLanguage, languageFromPath } from './language.js';
import { problemIdFromFilename } from './filename-parser.js';
import { hash } from './hashing.js';
import type {
  ParsedCommit,
  SolutionRevision,
  IngestionWarning,
} from './schemas.js';
export interface HistoryResult {
  commits: ParsedCommit[];
  groups: Map<string, SolutionRevision[]>;
  warnings: IngestionWarning[];
  deleted: Set<string>;
}
export async function collectHistory(
  git: GitRepository,
): Promise<HistoryResult> {
  const rows = await git.commits();
  const commits: ParsedCommit[] = [];
  const groups = new Map<string, SolutionRevision[]>();
  const warnings: IngestionWarning[] = [];
  const deleted = new Set<string>();
  for (let index = 0; index < rows.length; index++) {
    const row = rows[index]!;
    if (row.length < 5) continue;
    const [sha, parents, authoredAt, committedAt, ...subjectParts] = row;
    const rawSubject = subjectParts.join('\0');
    if (!sha || !authoredAt || !committedAt) continue;
    const parsed = parseCommitSubject(rawSubject);
    const changed = await git.changedFiles(sha);
    const commit: ParsedCommit = {
      sha,
      parentSha: parents?.split(' ')[0] || null,
      authoredAt,
      committedAt,
      chronologicalIndex: index,
      rawSubject,
      ...parsed,
      changedFiles: changed,
    };
    commits.push(commit);
    warnings.push(...parsed.warnings.map((w) => ({ ...w, sha })));
    for (const file of changed) {
      const candidate =
        file.status === 'D' ? (file.oldPath ?? file.path) : file.path;
      const fileLanguage = languageFromPath(candidate);
      if (!fileLanguage) continue;
      const fileId = problemIdFromFilename(candidate);
      const problemId = fileId ?? parsed.problemId;
      if (!problemId) {
        warnings.push({
          code: 'unknown-problem',
          message: `Could not determine problem for ${candidate}`,
          sha,
          path: candidate,
        });
        continue;
      }
      const inferred = inferLanguage(parsed.declaredLanguage, candidate);
      if (!inferred.language) continue;
      if (fileId && parsed.problemId && fileId !== parsed.problemId)
        warnings.push({
          code: 'problem-conflict',
          message: `Subject problem ${parsed.problemId} conflicts with filename problem ${fileId}; using ${fileId}.`,
          sha,
          path: candidate,
        });
      const localWarnings: IngestionWarning[] = [];
      if (inferred.warning)
        localWarnings.push({
          code: 'language-conflict',
          message: inferred.warning,
          sha,
          path: candidate,
        });
      const key = `${problemId}/${inferred.language}`;
      if (file.status === 'D') {
        deleted.add(key);
        continue;
      }
      deleted.delete(key);
      const code = await git.show(sha, file.path);
      if (code === null) continue;
      const list = groups.get(key) ?? [];
      const codeHash = hash(code);
      if (list.at(-1)?.codeHash === codeHash) continue;
      const previous = list.at(-1);
      let diff: string | null = null;
      let changedLineCounts: { additions: number; deletions: number } | null =
        null;
      if (previous) {
        diff = await git.git([
          'diff',
          '--no-color',
          '--unified=3',
          previous.sha,
          sha,
          '--',
          previous.sourcePath,
          file.path,
        ]);
        const lines = diff.split('\n');
        changedLineCounts = {
          additions: lines.filter(
            (l) => l.startsWith('+') && !l.startsWith('+++'),
          ).length,
          deletions: lines.filter(
            (l) => l.startsWith('-') && !l.startsWith('---'),
          ).length,
        };
      }
      const revision: SolutionRevision = {
        sha,
        shortSha: sha.slice(0, 7),
        parentSha: commit.parentSha,
        authoredAt,
        committedAt,
        chronologicalIndex: index,
        problemId,
        language: inferred.language,
        sourcePath: file.path,
        sourceFilename: path.basename(file.path),
        code,
        codeHash,
        markedWrong: parsed.markedWrong,
        commitComment: parsed.comment,
        rawCommitSubject: rawSubject,
        diffFromPreviousRelevantRevision: diff,
        changedLineCounts,
        approachId: 'chronological',
        narrativeIndex: list.length,
        shortChangeSummary: parsed.comment || 'Updates the solution.',
        warnings: localWarnings,
      };
      list.push(revision);
      groups.set(key, list);
    }
  }
  return { commits, groups, warnings, deleted };
}
