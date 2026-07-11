import { z } from 'zod';

export const SCHEMA_VERSION = 1;
export const PARSER_VERSION = '1';
export const PROMPT_VERSION = '2';
export const analysisStatusSchema = z.enum([
  'llm',
  'cached',
  'fallback',
  'stale',
]);
export const warningSchema = z.object({
  code: z.string(),
  message: z.string(),
  sha: z.string().optional(),
  path: z.string().optional(),
});
export type IngestionWarning = z.infer<typeof warningSchema>;
export const changedFileSchema = z.object({
  status: z.string(),
  path: z.string(),
  oldPath: z.string().nullable(),
});
export type ChangedFile = z.infer<typeof changedFileSchema>;
export const parsedCommitSchema = z.object({
  sha: z.string(),
  parentSha: z.string().nullable(),
  authoredAt: z.string(),
  committedAt: z.string(),
  chronologicalIndex: z.number().int().nonnegative(),
  rawSubject: z.string(),
  rawBody: z.string(),
  problemId: z.number().int().positive().nullable(),
  declaredLanguage: z.string().nullable(),
  normalizedLanguage: z.string().nullable(),
  markedWrong: z.boolean(),
  comment: z.string(),
  changedFiles: z.array(changedFileSchema),
  warnings: z.array(warningSchema),
});
export type ParsedCommit = z.infer<typeof parsedCommitSchema>;

export const revisionSchema = z.object({
  sha: z.string(),
  shortSha: z.string(),
  parentSha: z.string().nullable(),
  authoredAt: z.string(),
  committedAt: z.string(),
  chronologicalIndex: z.number().int().nonnegative(),
  problemId: z.number().int().positive(),
  language: z.string(),
  sourcePath: z.string(),
  sourceFilename: z.string(),
  code: z.string(),
  codeHash: z.string(),
  markedWrong: z.boolean(),
  commitComment: z.string(),
  rawCommitSubject: z.string(),
  commitBody: z.string(),
  diffFromPreviousRelevantRevision: z.string().nullable(),
  changedLineCounts: z
    .object({
      additions: z.number().int().nonnegative(),
      deletions: z.number().int().nonnegative(),
    })
    .nullable(),
  approachId: z.string(),
  narrativeIndex: z.number().int().nonnegative(),
  shortChangeSummary: z.string().max(120),
  warnings: z.array(warningSchema),
});
export type SolutionRevision = z.infer<typeof revisionSchema>;
export const approachSchema = z.object({
  id: z.string(),
  title: z.string().min(1).max(60),
  summary: z.string().max(160),
  order: z.number().int().nonnegative(),
  revisions: z.array(revisionSchema).min(1),
});
export const problemPageSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  problem: z.object({
    id: z.number().int().positive(),
    title: z.string(),
    slug: z.string(),
  }),
  language: z.object({
    id: z.string(),
    label: z.string(),
    shikiLanguage: z.string(),
  }),
  source: z.object({
    repositoryUrl: z.string().url(),
    latestPath: z.string().nullable(),
    latestSha: z.string().nullable(),
    deleted: z.boolean(),
  }),
  statistics: z.object({
    revisionCount: z.number().int().nonnegative(),
    approachCount: z.number().int().nonnegative(),
    incorrectRevisionCount: z.number().int().nonnegative(),
    firstCommittedAt: z.string().nullable(),
    lastCommittedAt: z.string().nullable(),
  }),
  analysis: z.object({
    status: analysisStatusSchema,
    model: z.string().nullable(),
    promptVersion: z.string(),
    inputHash: z.string(),
  }),
  approaches: z.array(approachSchema),
  chronologicalRevisionShas: z.array(z.string()),
  warnings: z.array(warningSchema),
});
export type GeneratedPage = z.infer<typeof problemPageSchema>;
export const indexSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  generatedAt: z.string(),
  sourceHeadSha: z.string().nullable(),
  questions: z.array(
    z.object({
      id: z.number().int().positive(),
      title: z.string(),
      slug: z.string(),
      languages: z.array(
        z.object({
          id: z.string(),
          label: z.string(),
          route: z.string(),
          revisionCount: z.number().int().nonnegative(),
          approachCount: z.number().int().nonnegative(),
          incorrectRevisionCount: z.number().int().nonnegative(),
          lastCommittedAt: z.string().nullable(),
        }),
      ),
      firstCommittedAt: z.string().nullable(),
      lastCommittedAt: z.string().nullable(),
    }),
  ),
});
export type GeneratedIndex = z.infer<typeof indexSchema>;
export const manifestSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  sourceRepository: z.string(),
  sourceHeadSha: z.string().nullable(),
  generatedAt: z.string(),
  parserVersion: z.string(),
  promptVersion: z.string(),
  processedCommits: z.record(
    z.string(),
    z.object({
      contentHash: z.string(),
      affectedGroups: z.array(z.string()),
      processedAt: z.string(),
    }),
  ),
  groups: z.record(
    z.string(),
    z.object({
      problemId: z.number().int().positive(),
      language: z.string(),
      inputHash: z.string(),
      outputPath: z.string(),
      promptVersion: z.string(),
      model: z.string().nullable(),
      analysisStatus: analysisStatusSchema,
      updatedAt: z.string(),
    }),
  ),
});
export type BuildManifest = z.infer<typeof manifestSchema>;
export const errorsSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  warnings: z.array(warningSchema),
  errors: z.array(
    z.object({
      code: z.string(),
      message: z.string(),
      sha: z.string().optional(),
    }),
  ),
});
export const favoritesSchema = z.object({
  problemIds: z.array(z.number().int().positive()),
});
export const siteSchema = z.object({
  title: z.string(),
  description: z.string(),
  siteUrl: z.string().url(),
  sourceRepositoryUrl: z.string().url(),
});

export const narrativeResultSchema = z.object({
  approaches: z
    .array(
      z.object({
        id: z.string().min(1),
        title: z.string().min(1).max(60),
        summary: z.string().max(160),
        order: z.number().int(),
        revisions: z
          .array(
            z.object({
              sha: z.string(),
              order: z.number().int(),
              shortChange: z.string().min(1).max(120),
            }),
          )
          .min(1),
      }),
    )
    .min(1),
});
export type NarrativeResult = z.infer<typeof narrativeResultSchema>;
export function validateNarrative(
  value: unknown,
  shas: string[],
): NarrativeResult {
  const parsed = narrativeResultSchema.parse(value);
  const ids = new Set<string>();
  const seen = new Set<string>();
  const allowed = new Set(shas);
  for (const a of parsed.approaches) {
    if (ids.has(a.id)) throw new Error(`Duplicate approach ID: ${a.id}`);
    ids.add(a.id);
    const orders = new Set<number>();
    for (const r of a.revisions) {
      if (!allowed.has(r.sha)) throw new Error(`Unknown SHA: ${r.sha}`);
      if (seen.has(r.sha)) throw new Error(`Duplicate SHA: ${r.sha}`);
      if (orders.has(r.order))
        throw new Error(`Duplicate revision order in ${a.id}`);
      orders.add(r.order);
      seen.add(r.sha);
    }
  }
  const missing = shas.filter((s) => !seen.has(s));
  if (missing.length) throw new Error(`Missing SHA: ${missing.join(', ')}`);
  return parsed;
}
