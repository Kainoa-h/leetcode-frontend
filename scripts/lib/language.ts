import path from 'node:path';
export const extensionLanguages: Record<string, string> = {
  '.rs': 'rust',
  '.java': 'java',
  '.py': 'python',
  '.ts': 'typescript',
  '.js': 'javascript',
  '.cpp': 'cpp',
  '.cc': 'cpp',
  '.cxx': 'cpp',
  '.c': 'c',
  '.cs': 'csharp',
  '.go': 'go',
  '.kt': 'kotlin',
  '.swift': 'swift',
  '.rb': 'ruby',
  '.php': 'php',
};
const aliases: Record<string, string> = {
  rs: 'rust',
  py: 'python',
  ts: 'typescript',
  js: 'javascript',
  'c++': 'cpp',
  cs: 'csharp',
};
export function normalizeLanguage(value: string) {
  const lower = value.trim().toLowerCase();
  return aliases[lower] ?? lower;
}
export function languageFromPath(file: string): string | null {
  const ext = extensionLanguages[path.extname(file).toLowerCase()];
  if (ext) return ext;
  const segments = file.toLowerCase().split(/[\\/]/);
  return (
    Object.values(extensionLanguages).find((l) => segments.includes(l)) ?? null
  );
}
export function inferLanguage(
  declared: string | null,
  file: string,
): { language: string | null; warning: string | null } {
  const d = declared ? normalizeLanguage(declared) : null;
  const f = languageFromPath(file);
  if (d && f && d !== f)
    return {
      language: f,
      warning: `Declared language ${d} conflicts with file language ${f}; using ${f}.`,
    };
  return { language: f ?? d ?? 'rust', warning: null };
}
export const languageInfo: Record<
  string,
  { label: string; shikiLanguage: string }
> = {
  rust: { label: 'Rust', shikiLanguage: 'rust' },
  java: { label: 'Java', shikiLanguage: 'java' },
  python: { label: 'Python', shikiLanguage: 'python' },
  typescript: { label: 'TypeScript', shikiLanguage: 'typescript' },
  javascript: { label: 'JavaScript', shikiLanguage: 'javascript' },
  cpp: { label: 'C++', shikiLanguage: 'cpp' },
  c: { label: 'C', shikiLanguage: 'c' },
  csharp: { label: 'C#', shikiLanguage: 'csharp' },
  go: { label: 'Go', shikiLanguage: 'go' },
  kotlin: { label: 'Kotlin', shikiLanguage: 'kotlin' },
  swift: { label: 'Swift', shikiLanguage: 'swift' },
  ruby: { label: 'Ruby', shikiLanguage: 'ruby' },
  php: { label: 'PHP', shikiLanguage: 'php' },
};
