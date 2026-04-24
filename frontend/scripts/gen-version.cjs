#!/usr/bin/env node
/**
 * ビルド前にpackage.jsonのバージョンからバージョンファイルを生成するスクリプト
 * package.jsonのprebuildで実行される
 */
const fs = require('fs');
const path = require('path');

// package.jsonからバージョンを読み取る
const packageJsonPath = path.join(__dirname, '../package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
const version = packageJson.version || 'dev';

const outPath = path.join(__dirname, '../src/buildVersion.ts');
const content = `// このファイルはビルド時に自動生成されます（scripts/gen-version.cjs）
// 手動で編集しないでください
export const BUILD_VERSION = '${version}';
`;

fs.writeFileSync(outPath, content, 'utf-8');
console.log(`[gen-version] BUILD_VERSION = ${version}`);
