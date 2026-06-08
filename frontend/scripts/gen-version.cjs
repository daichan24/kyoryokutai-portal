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

function safeRefName(value) {
  if (!value) return '';
  return String(value).replace(/^refs\/heads\//, '').trim().replace(/[^A-Za-z0-9._/-]/g, '');
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

function resolveBuildBranch() {
  return safeRefName(
    process.env.RENDER_GIT_BRANCH ||
    process.env.GITHUB_REF_NAME ||
    process.env.BRANCH ||
    gitValue('git branch --show-current', 'main') ||
    'main'
  ) || 'main';
}

function ensureFullGitHistory(branch) {
  const isShallow = gitValue('git rev-parse --is-shallow-repository', 'false');
  runGit(`git fetch origin ${branch} --quiet --depth=100000`);
  if (isShallow === 'true') {
    runGit('git fetch --unshallow --quiet');
    runGit(`git fetch origin ${branch} --quiet --depth=100000`);
  }
}

function readExistingBuildVersion() {
  const outPath = path.join(__dirname, '../src/buildVersion.ts');
  try {
    const current = fs.readFileSync(outPath, 'utf-8');
    const count = current.match(/BUILD_COMMIT_COUNT = '(\d+)'/)?.[1];
    const sha = current.match(/BUILD_COMMIT_SHA = '([^']+)'/)?.[1];
    return { count, sha };
  } catch {
    return { count: undefined, sha: undefined };
  }
}

const buildBranch = resolveBuildBranch();
ensureFullGitHistory(buildBranch);

const envCommitCount = process.env.VITE_BUILD_COMMIT_COUNT || process.env.BUILD_COMMIT_COUNT;
const remoteCommitCount = gitValue(`git rev-list --count origin/${buildBranch}`, '');
const rawCommitCount = remoteCommitCount || gitValue('git rev-list --count HEAD', envCommitCount || '0');
const commitSha = gitValue('git rev-parse --short HEAD', 'unknown');
const existingBuild = readExistingBuildVersion();
let commitCount = rawCommitCount;

if (rawCommitCount === '1') {
  if (envCommitCount) {
    commitCount = envCommitCount;
  } else if (existingBuild.count && Number(existingBuild.count) > 1) {
    commitCount = existingBuild.sha && existingBuild.sha !== commitSha
      ? String(Number(existingBuild.count) + 1)
      : existingBuild.count;
  }
}
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
console.log(`[gen-version] BUILD_VERSION = ${version}, BUILD_COMMIT_COUNT = ${commitCount}, BUILD_COMMIT_SHA = ${commitSha}, BUILD_BRANCH = ${buildBranch}`);
