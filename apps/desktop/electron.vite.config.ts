import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'electron-vite';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  main: {
    build: {
      externalizeDeps: {
        exclude: ['@asahi/server'],
      },
      rollupOptions: {
        input: resolve(root, 'src/main/index.ts'),
      },
    },
  },
  preload: {
    build: {
      rollupOptions: {
        input: resolve(root, 'src/preload/index.ts'),
        output: {
          entryFileNames: 'index.cjs',
          format: 'cjs',
        },
      },
    },
  },
  renderer: {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        'next/link': resolve(root, 'src/renderer/next-link.tsx'),
        'next/navigation': resolve(root, 'src/renderer/next-navigation.ts'),
      },
    },
    root: resolve(root, 'src/renderer'),
    worker: {
      format: 'es',
    },
  },
});
