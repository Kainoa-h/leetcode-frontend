import fs from 'node:fs/promises';
import path from 'node:path';
import {
  indexSchema,
  manifestSchema,
  errorsSchema,
  problemPageSchema,
  favoritesSchema,
  siteSchema,
} from './lib/schemas.js';
async function files(dir: string): Promise<string[]> {
  try {
    return (await fs.readdir(dir, { withFileTypes: true })).flatMap((e) =>
      e.isDirectory() ? [] : [path.join(dir, e.name)],
    );
  } catch {
    return [];
  }
}
const root = process.cwd();
indexSchema.parse(
  JSON.parse(
    await fs.readFile(path.join(root, 'generated/index.json'), 'utf8'),
  ),
);
manifestSchema.parse(
  JSON.parse(
    await fs.readFile(path.join(root, 'generated/manifest.json'), 'utf8'),
  ),
);
errorsSchema.parse(
  JSON.parse(
    await fs.readFile(
      path.join(root, 'generated/ingestion-errors.json'),
      'utf8',
    ),
  ),
);
favoritesSchema.parse(
  JSON.parse(
    await fs.readFile(path.join(root, 'config/favorites.json'), 'utf8'),
  ),
);
siteSchema.parse(
  JSON.parse(await fs.readFile(path.join(root, 'config/site.json'), 'utf8')),
);
for (const id of await fs
  .readdir(path.join(root, 'generated/problems'))
  .catch(() => []))
  for (const file of await files(path.join(root, 'generated/problems', id)))
    problemPageSchema.parse(JSON.parse(await fs.readFile(file, 'utf8')));
console.log('[validate] Generated content and configuration are valid.');
