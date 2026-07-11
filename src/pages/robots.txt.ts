import type { APIRoute } from 'astro';
import { site } from '../lib/data';
export const GET: APIRoute = () =>
  new Response(
    `User-agent: *\nAllow: /\nSitemap: ${site.siteUrl}/sitemap-index.xml\n`,
    { headers: { 'Content-Type': 'text/plain' } },
  );
