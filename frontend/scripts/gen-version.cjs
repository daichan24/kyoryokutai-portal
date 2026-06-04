#!/usr/bin/env node
/**
 * ビルド前にpackage.jsonのバージョンからバージョンファイルを生成するスクリプト
 * package.jsonのprebuildで実行される
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// package.jsonからバージョンを読み取る
const packageJsonPath = path.join(__dirname, '../package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
const version = packageJson.version || 'dev';

function gitValue(command, fallback) {
  try {
    return execSync(command, {
      cwd: path.join(__dirname, '..', '..'),
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim() || fallback;
  } catch {
    return fallback;
  }
}

const commitCount = gitValue('git rev-list --count HEAD', '0');
const commitSha = gitValue('git rev-parse --short HEAD', 'unknown');
const buildDate = new Date().toISOString();

const outPath = path.join(__dirname, '../src/buildVersion.ts');
const content = `// このファイルはビルド時に自動生成されます（scripts/gen-version.cjs）
// 手動で編集しないでください
export const BUILD_VERSION = '${version}';
export const BUILD_COMMIT_COUNT = '${commitCount}';
export const BUILD_COMMIT_SHA = '${commitSha}';
export const BUILD_DATE = '${buildDate}';
`;

fs.writeFileSync(outPath, content, 'utf-8');
console.log(`[gen-version] BUILD_VERSION = ${version}, BUILD_COMMIT_COUNT = ${commitCount}, BUILD_COMMIT_SHA = ${commitSha}`);
