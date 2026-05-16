import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Tauri expects a fixed port and forwards stdout/stderr to it.
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
  },
  envPrefix: ['VITE_', 'TAURI_'],
  build: {
    target: ['es2022', 'safari15'],
    outDir: 'dist',
    rollupOptions: {
      // `@tauri-apps/plugin-notification` is loaded via a dynamic import
      // inside src/lib/notifications.ts with a graceful fallback. It's
      // not installed by default (Tauri plugins are optional), so we
      // tell Rollup to treat it as external instead of resolving it
      // at build time.
      external: ['@tauri-apps/plugin-notification'],
    },
  },
});
