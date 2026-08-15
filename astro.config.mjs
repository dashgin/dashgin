import { defineConfig } from 'astro/config';

// Deployed via Dokploy as a static site (Dockerfile: node build → nginx serve).
// Served from the domain root, so no base path. Internal links use
// import.meta.env.BASE_URL so they adapt automatically if this ever changes.
export default defineConfig({
  base: '/',
  trailingSlash: 'ignore',
});
