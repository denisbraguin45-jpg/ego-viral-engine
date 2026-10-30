import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3333',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:3333',
        changeOrigin: true,
      },
      '/r': {
        target: 'http://localhost:3333',
        changeOrigin: true,
      },
    },
  },
});
