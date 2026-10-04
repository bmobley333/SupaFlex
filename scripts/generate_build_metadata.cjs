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

let commitCount = 627;
let gitCommit = 'dev';

try {
  const countStr = execSync('git rev-list --count HEAD', { cwd: rootDir, encoding: 'utf-8' }).trim();
  const parsed = parseInt(countStr, 10);
  if (!isNaN(parsed) && parsed > 0) {
    commitCount = parsed;
  }
} catch {
  // Fallback if shallow clone on Vercel
  if (fs.existsSync(versionJsonPath)) {
    try {
      const prev = JSON.parse(fs.readFileSync(versionJsonPath, 'utf-8'));
      if (prev.vercelBuild) {
        const prevCount = parseInt(prev.vercelBuild.replace(/\D/g, ''), 10);
        if (!isNaN(prevCount)) commitCount = prevCount + 1;
      }
    } catch {}
  }
}

try {
  gitCommit = execSync('git rev-parse --short HEAD', { cwd: rootDir, encoding: 'utf-8' }).trim();
} catch {
  if (process.env.VERCEL_GIT_COMMIT_SHA) {
    gitCommit = process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 7);
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
