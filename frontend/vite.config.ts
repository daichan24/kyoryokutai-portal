import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { execSync } from 'child_process';

// バージョン生成関数（Gitコミットハッシュ + タイムスタンプ）
function getBuildId(): string {
  // 環境変数が既に設定されている場合はそれを使用（ビルドスクリプトから渡される場合）
  if (process.env.VITE_BUILD_ID) {
    return process.env.VITE_BUILD_ID;
  }

  // 開発環境または環境変数が設定されていない場合
  try {
    // Gitコミットハッシュの短縮版（7文字）を取得
    const commitHash = execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
    const timestamp = new Date().toISOString().replace(/[-:T]/g, '').split('.')[0].slice(0, 14);
    return `${commitHash}-${timestamp}`;
  } catch (error) {
    // Gitが使えない場合はタイムスタンプのみ
    const timestamp = new Date().toISOString().replace(/[-:T]/g, '').split('.')[0].slice(0, 14);
    return `dev-${timestamp}`;
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
