import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  server: { host: '127.0.0.1', port: 4320, strictPort: true, proxy: { '/api': process.env.CATALYST_API_ORIGIN || 'http://127.0.0.1:4321' } },
  preview: { host: '127.0.0.1', port: 4320, strictPort: true, proxy: { '/api': process.env.CATALYST_API_ORIGIN || 'http://127.0.0.1:4321' } },
});
