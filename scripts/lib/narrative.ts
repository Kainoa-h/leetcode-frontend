import type { NarrativeResult, SolutionRevision } from './schemas.js';
import {
  llmNarrativeResultSchema,
  validateNarrative,
  PROMPT_VERSION,
} from './schemas.js';
export function shouldRequestLlm(revisionCount: number): boolean {
  return revisionCount > 1;
}
export const NARRATIVE_INSTRUCTIONS = [
  'An approach is a fundamentally different algorithm, strategy, data model, or way of attacking the problem.',
  'A revision stays in the same approach when it preserves the general algorithmic strategy, including improvements to time or space complexity, optimizations, cleanup, refactoring, or making the code more idiomatic.',
  'Do not create a new approach merely because complexity improved or the implementation became more idiomatic when the general solution strategy remains the same.',
  'Create a new approach only when the core way of solving the problem materially changes.',
  'Assign every revision ID from requiredRevisionIds to exactly one approach and include it exactly once in the entire response.',
  'Never duplicate a revision ID, omit a required revision ID, or return an ID that is not in requiredRevisionIds.',
  'Narrative order is presentation only; chronology remains separate.',
  'Keep incorrect markers; do not invent failures or complexity claims unsupported by the code.',
  'Return only data satisfying the supplied schema.',
] as const;
export function fallbackNarrative(
  revisions: Pick<SolutionRevision, 'sha' | 'commitComment'>[],
): NarrativeResult {
  return {
    approaches: [
      {
        id: 'chronological',
        title: 'Solution history',
        summary: 'Revisions in chronological order.',
        order: 0,
        revisions: revisions.map((r, i) => ({
          sha: r.sha,
          order: i,
          shortChange: (r.commitComment || 'Updates the solution.').slice(
            0,
            120,
          ),
        })),
      },
    ],
  };
}
export function narrativePrompt(
  problemId: number,
  title: string,
  language: string,
  revisions: SolutionRevision[],
  existing?: NarrativeResult,
) {
  return JSON.stringify({
    promptVersion: PROMPT_VERSION,
    instructions: NARRATIVE_INSTRUCTIONS,
    problem: { id: problemId, title, language },
    requiredRevisionIds: revisions.map((_, index) => index + 1),
    revisions: revisions.map((r, index) => ({
      revisionId: index + 1,
      subject: r.rawCommitSubject,
      body: r.commitBody,
      markedWrong: r.markedWrong,
      code: r.code,
      diff: r.diffFromPreviousRelevantRevision,
    })),
    existing: existing ?? null,
  });
}
export function validateRevisionIdNarrative(
  value: unknown,
  revisions: Pick<SolutionRevision, 'sha'>[],
): NarrativeResult {
  const shaByRevisionId = new Map(
    revisions.map((revision, index) => [index + 1, revision.sha]),
  );
  const narrative = llmNarrativeResultSchema.parse(value);
  const mapped = {
    approaches: narrative.approaches.map((approach) => ({
      ...approach,
      revisions: approach.revisions.map((revision) => ({
        sha: (() => {
          const sha = shaByRevisionId.get(revision.revisionId);
          if (!sha)
            throw new Error(`Unknown revision ID: ${revision.revisionId}`);
          return sha;
        })(),
        order: revision.order,
        shortChange: revision.shortChange,
      })),
    })),
  };
  return validateNarrative(
    mapped,
    revisions.map((revision) => revision.sha),
  );
}
export { validateNarrative };
