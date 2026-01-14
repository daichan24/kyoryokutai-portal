import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { readFileSync, writeFileSync } from 'fs';

// バージョン管理関数
function getVersion(): string {
  const versionFile = path.resolve(__dirname, 'version.json');
  
  try {
    // バージョンファイルを読み込む
    const versionData = JSON.parse(readFileSync(versionFile, 'utf-8'));
    let { major, minor } = versionData;
    
    // 環境変数でバージョンアップグレードが指定されている場合
    if (process.env.VERSION_UPGRADE === 'true') {
      major += 1;
      minor = 1;
    } else {
      // 通常のプッシュ: マイナーバージョンをインクリメント
      minor += 1;
    }
    
    // バージョンファイルを更新
    const newVersion = { major, minor };
    writeFileSync(versionFile, JSON.stringify(newVersion, null, 2) + '\n');
    
    return `${major}.${minor}`;
  } catch (error) {
    // ファイルが存在しない場合は1.1から開始
    const initialVersion = { major: 1, minor: 1 };
    writeFileSync(versionFile, JSON.stringify(initialVersion, null, 2) + '\n');
    return '1.1';
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
    'import.meta.env.VITE_BUILD_ID': JSON.stringify(getVersion()),
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
