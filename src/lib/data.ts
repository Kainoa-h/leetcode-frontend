import indexData from '../../generated/index.json';
import favoritesData from '../../config/favorites.json';
import siteData from '../../config/site.json';
import {
  indexSchema,
  favoritesSchema,
  siteSchema,
  problemPageSchema,
  type GeneratedPage,
} from '../../scripts/lib/schemas';
export const index = indexSchema.parse(indexData);
export const favorites = favoritesSchema.parse(favoritesData);
export const site = siteSchema.parse(siteData);
const modules = import.meta.glob('../../generated/problems/*/*.json', {
  eager: true,
  import: 'default',
});
export const pages = [...Object.values(modules)].map((v) =>
  problemPageSchema.parse(v),
) as GeneratedPage[];
export function pageFor(id: number, language: string) {
  return pages.find((p) => p.problem.id === id && p.language.id === language);
}
export function sourceUrl(sha: string, path?: string) {
  const base = site.sourceRepositoryUrl.replace(/\/$/, '');
  return path
    ? `${base}/blob/${sha}/${path.split('/').map(encodeURIComponent).join('/')}`
    : `${base}/commit/${sha}`;
}
