import { defineConfig } from 'vite';

export default defineConfig({
  base: '/',
  server: {
    host: '0.0.0.0',
    allowedHosts: ['.vercel.run', '.vercel.app']
  }
});