import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { execSync } from 'child_process';

// バージョン生成関数（Gitコミットハッシュまたはタイムスタンプ）
function getBuildId(): string {
  try {
    // Gitコミットハッシュの短縮版（7文字）を取得
    const commitHash = execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
    const timestamp = new Date().toISOString().replace(/[-:T]/g, '').split('.')[0].slice(0, 14);
    return `${timestamp}-${commitHash}`;
  } catch (error) {
    // Gitが使えない場合はタイムスタンプのみ
    const timestamp = new Date().toISOString().replace(/[-:T]/g, '').split('.')[0].slice(0, 14);
    return timestamp;
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
