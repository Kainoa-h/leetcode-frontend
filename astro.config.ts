import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import site from './config/site.json';
export default defineConfig({ site: site.siteUrl, output: 'static', integrations: [sitemap()], vite: { plugins: [tailwindcss()] } });
