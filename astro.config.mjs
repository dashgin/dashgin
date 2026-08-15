import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// Deployed via Dokploy as a static site (Dockerfile: node build → nginx serve).
// Served from the domain root, so no base path. Internal links use
// import.meta.env.BASE_URL so they adapt automatically if this ever changes.
//
// `site` is the canonical origin. It drives the absolute URLs in rss.xml and
// sitemap-index.xml, which is what dev.to / Hashnode use as rel=canonical when
// they import a post — so this must be the origin that actually serves the site.
// Currently that's www; if the apex is ever cut over, change it here only.
export default defineConfig({
  site: 'https://www.dashgin.com',
  base: '/',
  trailingSlash: 'ignore',
  integrations: [sitemap()],
});
