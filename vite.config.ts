import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// BASE_PATH: the URL path the site is served from.
//   - Local dev and most hosts: leave unset (defaults to "./", which works anywhere).
//   - GitHub Pages project sites: set VITE_BASE_PATH="/<repo-name>/" at build time.
// The deploy workflow fills this in from the repository name automatically.
// Routing uses the URL hash, so no server rewrite rules are needed on any host.
export default defineConfig({
  base: process.env.VITE_BASE_PATH || './',
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
