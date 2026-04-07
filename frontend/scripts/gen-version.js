#!/usr/bin/env node
/**
 * ビルド前にgitコミット数からバージョンファイルを生成するスクリプト
 * package.jsonのprebuildで実行される
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

let count = 'dev';
try {
  count = execSync('git rev-list --count HEAD', { encoding: 'utf-8' }).trim();
} catch (e) {
  // gitが使えない環境（CI等）では環境変数から取得
  count = process.env.GIT_COMMIT_COUNT || process.env.RENDER_GIT_COMMIT_COUNT || 'dev';
}

const version = `#${count}`;
const outPath = path.join(__dirname, '../src/buildVersion.ts');
const content = `// このファイルはビルド時に自動生成されます（scripts/gen-version.js）
// 手動で編集しないでください
export const BUILD_VERSION = '${version}';
`;

fs.writeFileSync(outPath, content, 'utf-8');
console.log(`[gen-version] BUILD_VERSION = ${version}`);
