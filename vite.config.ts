import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';

let versionMetadata = {
  appVersion: '3',
  vercelBuild: '627v',
  gitCommit: 'prod',
  builtAt: new Date().toISOString(),
};

try {
  const versionPath = path.resolve(__dirname, './public/version.json');
  if (fs.existsSync(versionPath)) {
    versionMetadata = JSON.parse(fs.readFileSync(versionPath, 'utf-8'));
  }
} catch (e) {
  console.warn('[vite.config] Could not read version.json:', e);
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(versionMetadata.appVersion),
    __VERCEL_BUILD__: JSON.stringify(versionMetadata.vercelBuild),
    __GIT_COMMIT__: JSON.stringify(versionMetadata.gitCommit),
    __BUILD_TIMESTAMP__: JSON.stringify(versionMetadata.builtAt),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    strictPort: true,
  },
});
