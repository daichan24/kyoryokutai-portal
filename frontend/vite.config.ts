import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { execSync } from 'child_process';

function getBuildId(): string {
  // 環境変数が設定されていればそれを使う（CI/CD環境）
  if (process.env.VITE_BUILD_ID) return process.env.VITE_BUILD_ID;
  try {
    const count = execSync('git rev-list --count HEAD', { encoding: 'utf-8' }).trim();
    return `#${count}`;
  } catch {
    return '#dev';
  }
}

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  define: {
    'import.meta.env.VITE_BUILD_ID': JSON.stringify(getBuildId()),
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    watch: {
      usePolling: true,
      build: { sourcemap: true }
    },
  },
});
