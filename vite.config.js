import { defineConfig } from 'vite';

export default defineConfig({
  root: './client',
  server: {
    host: '0.0.0.0',
    hmr: true,
    allowedHosts: true,
    port: 3000,
    proxy: {
      '/message': {
        target: 'http://localhost:3000',
        changeOrigin: true
      },
      '/save-stats': {
        target: 'http://localhost:3000',
        changeOrigin: true
      },
      '/ws': {
        target: 'ws://localhost:3000',
        ws: true,
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true
  }
});
