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
const repoRoot = path.join(__dirname, '..', '..');

function gitValue(command, fallback) {
  try {
    return execSync(command, {
      cwd: repoRoot,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim() || fallback;
  } catch {
    return fallback;
  }
}

function runGit(command) {
  try {
    execSync(command, {
      cwd: repoRoot,
      stdio: ['ignore', 'ignore', 'ignore'],
    });
  } catch {
    // デプロイ環境でfetchできない場合は、後続のフォールバックを使う
  }
}

function ensureFullGitHistory() {
  const isShallow = gitValue('git rev-parse --is-shallow-repository', 'false');
  if (isShallow === 'true') {
    runGit('git fetch --unshallow --quiet');
  }
}

ensureFullGitHistory();

const rawCommitCount = gitValue('git rev-list --count HEAD', process.env.VITE_BUILD_COMMIT_COUNT || process.env.BUILD_COMMIT_COUNT || '0');
const commitCount = rawCommitCount === '1' && (process.env.VITE_BUILD_COMMIT_COUNT || process.env.BUILD_COMMIT_COUNT)
  ? (process.env.VITE_BUILD_COMMIT_COUNT || process.env.BUILD_COMMIT_COUNT)
  : rawCommitCount;
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
