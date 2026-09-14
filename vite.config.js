import { defineConfig } from 'vite';

export default defineConfig({
  // Use React's automatic JSX runtime so JSX files do not require a
  // manual `import React` solely to render JSX.
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: 'react',
  },
  build: {
    sourcemap: false,
  },
});
