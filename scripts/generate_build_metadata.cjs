// C:\Repos\Projects\SupaFlex\scripts\generate_build_metadata.cjs
// Deterministic Build Metadata Generator for SupaFlex
// Injects App Version, Monotonic Vercel Build ID (e.g. 627v), Git Commit, and Timestamp into public/version.json

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const pkgPath = path.join(rootDir, 'package.json');
const publicDir = path.join(rootDir, 'public');
const versionJsonPath = path.join(publicDir, 'version.json');

let appVersion = '3';
try {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  if (pkg.version) {
    // Extract major version for clean 3.xxxv.xxxs format
    appVersion = pkg.version.split('.')[0] || '3';
  }
} catch (e) {
  console.warn('[BuildMetadata] Could not read package.json version:', e.message);
}

let commitCount = 631;
let gitCommit = 'dev';

try {
  gitCommit = execSync('git rev-parse --short HEAD', { cwd: rootDir, encoding: 'utf-8' }).trim();
} catch {
  if (process.env.VERCEL_GIT_COMMIT_SHA) {
    gitCommit = process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 7);
  }
}

// Read previously committed version.json if available
let prevCount = 0;
let prevCommit = '';
if (fs.existsSync(versionJsonPath)) {
  try {
    const prev = JSON.parse(fs.readFileSync(versionJsonPath, 'utf-8'));
    if (prev.vercelBuild) {
      const parsedPrev = parseInt(prev.vercelBuild.replace(/\D/g, ''), 10);
      if (!isNaN(parsedPrev)) prevCount = parsedPrev;
    }
    if (prev.gitCommit) {
      prevCommit = prev.gitCommit;
    }
  } catch {}
}

let isShallow = false;
try {
  isShallow = execSync('git rev-parse --is-shallow-repository', { cwd: rootDir, encoding: 'utf-8' }).trim() === 'true';
} catch {}

try {
  const countStr = execSync('git rev-list --count HEAD', { cwd: rootDir, encoding: 'utf-8' }).trim();
  const parsed = parseInt(countStr, 10);
  if (!isNaN(parsed) && parsed > 0) {
    if (isShallow && prevCount > parsed) {
      // Vercel shallow clone (e.g. depth 10) - preserve monotonic commit count from committed version.json
      commitCount = prevCommit === gitCommit ? prevCount : prevCount + 1;
    } else {
      commitCount = Math.max(parsed, prevCount);
    }
  } else if (prevCount > 0) {
    commitCount = prevCommit === gitCommit ? prevCount : prevCount + 1;
  }
} catch {
  if (prevCount > 0) {
    commitCount = prevCommit === gitCommit ? prevCount : prevCount + 1;
  }
}

const vercelBuild = `${commitCount}v`;
const builtAt = new Date().toISOString();

const metadata = {
  appVersion,
  vercelBuild,
  gitCommit,
  builtAt,
};

if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

fs.writeFileSync(versionJsonPath, JSON.stringify(metadata, null, 2), 'utf-8');
console.log(`[BuildMetadata] Generated ${versionJsonPath} -> App: ${appVersion}, Vercel Build: ${vercelBuild} (${gitCommit})`);
