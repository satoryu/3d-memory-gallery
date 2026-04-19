// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';

// https://astro.build/config
export default defineConfig({
  site: 'https://satoryu.github.io',
  base: '/3d-memory-gallery',
  integrations: [react()],
  vite: {
    ssr: {
      // model-viewer is a Web Component that touches window/HTMLElement at import time.
      // Keep it out of Astro's SSR bundle so it only loads in the browser.
      noExternal: ['@google/model-viewer'],
    },
  },
});
