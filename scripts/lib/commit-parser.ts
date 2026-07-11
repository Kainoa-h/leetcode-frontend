import type { ParsedCommit } from './schemas.js';
import { normalizeLanguage } from './language.js';
const SUBJECT =
  /^(?:(?<language>[a-zA-Z+#.]+)\s+)?(?<id>\d+)(?<wrong>!)?\s*:?(?:\s*(?<comment>.*))?$/;
export function parseCommitSubject(
  subject: string,
): Pick<
  ParsedCommit,
  | 'problemId'
  | 'declaredLanguage'
  | 'normalizedLanguage'
  | 'markedWrong'
  | 'comment'
  | 'warnings'
> {
  const m = SUBJECT.exec(subject.trim());
  if (!m?.groups)
    return {
      problemId: null,
      declaredLanguage: null,
      normalizedLanguage: null,
      markedWrong: false,
      comment: '',
      warnings: [
        {
          code: 'malformed-subject',
          message: `Could not parse commit subject: ${subject}`,
        },
      ],
    };
  const declared = m.groups.language?.toLowerCase() ?? null;
  return {
    problemId: Number(m.groups.id),
    declaredLanguage: declared,
    normalizedLanguage: declared ? normalizeLanguage(declared) : 'rust',
    markedWrong: Boolean(m.groups.wrong),
    comment: m.groups.comment?.trim() ?? '',
    warnings: [],
  };
}
