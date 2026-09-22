#!/usr/bin/env node
// One-command setup of the GlobeGuard workspace on a new machine.
//
//   node scripts/bootstrap.mjs
//
// Clones the two application repositories next to this file — docker-compose.yml builds them from
// relative paths, so the layout is not optional — and writes a .env with freshly generated local
// secrets. Safe to re-run: it never overwrites an existing clone or an existing .env.
//
// The repository URLs are derived from this repo's own `origin`, so a fork or a different account
// works without editing anything. Override either with an environment variable:
//   BACKEND_REPO_URL=... FRONTEND_REPO_URL=... node scripts/bootstrap.mjs
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
process.chdir(root);

const REPOS = [
    { dir: 'globeguard-backend', env: 'BACKEND_REPO_URL', name: 'backend' },
    { dir: 'globeguard-frontend', env: 'FRONTEND_REPO_URL', name: 'storefront' },
];

// Secrets that only have to be unguessable, not shared: each machine generates its own.
const GENERATED = ['SUPERADMIN_PASSWORD', 'COOKIE_SECRET', 'REVALIDATION_SECRET'];

let failed = false;

console.log(`GlobeGuard workspace: ${root}\n`);

const origin = tryGit(['remote', 'get-url', 'origin']);
if (origin) {
    console.log(`  workspace origin: ${origin}`);
}

for (const repo of REPOS) {
    const target = path.join(root, repo.dir);
    if (fs.existsSync(path.join(target, '.git'))) {
        const branch = tryGit(['rev-parse', '--abbrev-ref', 'HEAD'], target) || '?';
        console.log(`  ${repo.dir.padEnd(22)} already cloned (on ${branch})`);
        continue;
    }
    if (fs.existsSync(target) && fs.readdirSync(target).length) {
        console.log(`  ${repo.dir.padEnd(22)} SKIPPED: the directory exists and is not a git clone`);
        failed = true;
        continue;
    }
    const url = process.env[repo.env] || deriveUrl(origin, repo.dir);
    if (!url) {
        console.log(
            `  ${repo.dir.padEnd(22)} NEEDS A URL: this repo has no origin to derive one from.\n` +
                `                         Re-run with ${repo.env}=<url>, or clone it yourself into ${repo.dir}/`,
        );
        failed = true;
        continue;
    }
    console.log(`  ${repo.dir.padEnd(22)} cloning from ${url}`);
    try {
        execFileSync('git', ['clone', url, repo.dir], { stdio: 'inherit' });
    } catch {
        console.log(`  ${repo.dir.padEnd(22)} CLONE FAILED — check the URL and your access`);
        failed = true;
    }
}

console.log('');
writeEnv();

console.log('');
if (failed) {
    console.log('Some steps did not finish — see above. Nothing was overwritten.');
} else {
    console.log('Next: docker compose build, then the first-boot recipe in ONBOARDING.md section 2.');
}
process.exitCode = failed ? 1 : 0;

// --- helpers -----------------------------------------------------------------------------------

function writeEnv() {
    const envPath = path.join(root, '.env');
    if (fs.existsSync(envPath)) {
        console.log('  .env                   already exists, left untouched');
        return;
    }
    const examplePath = path.join(root, '.env.example');
    if (!fs.existsSync(examplePath)) {
        console.log('  .env                   SKIPPED: .env.example is missing');
        failed = true;
        return;
    }

    let contents = fs.readFileSync(examplePath, 'utf8');
    const filled = [];
    for (const key of GENERATED) {
        const secret = crypto.randomBytes(24).toString('base64url');
        const before = contents;
        contents = contents.replace(new RegExp(`^${key}=.*$`, 'm'), `${key}=${secret}`);
        if (contents !== before) {
            filled.push(key);
        }
    }
    fs.writeFileSync(envPath, contents);
    console.log(`  .env                   written from .env.example, generated ${filled.join(', ')}`);
    console.log('                         (local-only values; .env is gitignored)');
}

function deriveUrl(originUrl, dir) {
    if (!originUrl) {
        return null;
    }
    // Replace the last path segment, keeping scheme, host, account and any .git suffix. Works for
    // https://host/account/name.git and git@host:account/name.git alike.
    const match = /^(.*[/:][^/]+\/)([^/]+?)(\.git)?$/.exec(originUrl.trim());
    return match ? `${match[1]}${dir}${match[3] || ''}` : null;
}

function tryGit(args, cwd = root) {
    try {
        return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    } catch {
        return null;
    }
}
