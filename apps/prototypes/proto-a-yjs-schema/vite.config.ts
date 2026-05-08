import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// strictPort=true so the Playwright dual-tab test can rely on
// http://localhost:5173 (see playwright.config.ts webServer).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
  },
});
