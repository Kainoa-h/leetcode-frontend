import { createHighlighter, type Highlighter } from 'shiki';
let promise: Promise<Highlighter> | undefined;
const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ]!,
  );
export async function highlight(code: string, lang: string) {
  try {
    promise ??= createHighlighter({
      themes: ['github-dark', 'github-light'],
      langs: [
        'rust',
        'java',
        'python',
        'typescript',
        'javascript',
        'cpp',
        'c',
        'csharp',
        'go',
        'kotlin',
        'swift',
        'ruby',
        'php',
        'diff',
      ],
    });
    const h = await promise;
    const resolved = h.getLoadedLanguages().includes(lang) ? lang : 'text';
    return h.codeToHtml(code, {
      lang: resolved,
      themes: { light: 'github-light', dark: 'github-dark' },
      transformers: [
        {
          line(node, line) {
            node.properties['data-line'] = line;
          },
        },
      ],
    });
  } catch {
    return `<pre class="shiki"><code>${escape(code)}</code></pre>`;
  }
}
