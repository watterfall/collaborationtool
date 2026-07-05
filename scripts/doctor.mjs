#!/usr/bin/env node

import { accessSync, constants, existsSync, readFileSync } from 'node:fs';
import net from 'node:net';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const results = [];

function record(status, label, detail) {
  results.push({ status, label, detail });
}

function run(cmd, args, options = {}) {
  return spawnSync(cmd, args, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  });
}

function versionTuple(value) {
  const match = value.trim().match(/(\d+)\.(\d+)\.(\d+)/);
  if (!match) return null;
  return match.slice(1).map(Number);
}

function atLeast(tuple, major, minor = 0) {
  if (!tuple) return false;
  return tuple[0] > major || (tuple[0] === major && tuple[1] >= minor);
}

function checkCommandVersion(label, cmd, args, minMajor, minMinor = 0) {
  const result = run(cmd, args);
  if (result.error) {
    record('fail', label, `${cmd} is not available`);
    return;
  }
  const text = `${result.stdout}${result.stderr}`.trim();
  const tuple = versionTuple(text);
  if (!atLeast(tuple, minMajor, minMinor)) {
    record('fail', label, `found "${text}", expected >= ${minMajor}.${minMinor}`);
    return;
  }
  record('pass', label, text.split('\n')[0]);
}

function checkPnpmConfig() {
  const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
  if (pkg.pnpm) {
    record('warn', 'pnpm config location', 'package.json still has a pnpm field; pnpm 11 ignores it');
  } else {
    record('pass', 'pnpm config location', 'package.json has no ignored pnpm field');
  }

  const workspace = readFileSync(resolve(root, 'pnpm-workspace.yaml'), 'utf8');
  if (workspace.includes('overrides:') && workspace.includes('allowBuilds:')) {
    record('pass', 'pnpm-workspace.yaml', 'overrides and allowBuilds are in the active config file');
  } else {
    record('warn', 'pnpm-workspace.yaml', 'missing overrides or allowBuilds; pnpm install may drift');
  }
}

function checkDocker() {
  const docker = run('docker', ['--version']);
  if (docker.error) {
    record('warn', 'Docker', 'not installed or not on PATH; db:up and integration tests need it');
    return;
  }
  const compose = run('docker', ['compose', 'version']);
  if (compose.status === 0) {
    record('pass', 'Docker Compose', compose.stdout.trim().split('\n')[0]);
  } else {
    record('warn', 'Docker Compose', 'docker exists, but `docker compose version` failed');
  }
}

async function checkDatabase() {
  const raw = process.env.DATABASE_URL;
  if (!raw) {
    record('warn', 'DATABASE_URL', 'not set; db round-trip, gateway e2e and snapshot integration will skip');
    return;
  }

  let url;
  try {
    url = new URL(raw);
  } catch {
    record('fail', 'DATABASE_URL', 'is not a valid URL');
    return;
  }
  if (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') {
    record('fail', 'DATABASE_URL', `expected postgres/postgresql protocol, got ${url.protocol}`);
    return;
  }

  const host = url.hostname || 'localhost';
  const port = Number(url.port || 5432);
  const reachable = await canConnect(host, port, 800);
  if (reachable) {
    record('pass', 'Postgres TCP', `${host}:${port} reachable`);
  } else {
    record('warn', 'Postgres TCP', `${host}:${port} not reachable; run pnpm db:up or check DATABASE_URL`);
  }
}

function canConnect(host, port, timeoutMs) {
  return new Promise((resolveResult) => {
    const socket = net.createConnection({ host, port });
    const done = (ok) => {
      socket.removeAllListeners();
      socket.destroy();
      resolveResult(ok);
    };
    socket.setTimeout(timeoutMs, () => done(false));
    socket.once('connect', () => done(true));
    socket.once('error', () => done(false));
  });
}

function isExecutable(path) {
  try {
    accessSync(path, process.platform === 'win32' ? constants.F_OK : constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function parseChromiumHeadlessInstallLocation(output) {
  const match = output.match(/browser:\s+chromium-headless-shell[\s\S]*?Install location:\s+(.+)/);
  return match?.[1]?.trim();
}

function chromiumHeadlessExecutables(installLocation) {
  const platformPath =
    process.platform === 'win32'
      ? 'chrome-win/headless_shell.exe'
      : process.platform === 'darwin'
        ? 'chrome-mac/headless_shell'
        : 'chrome-linux/headless_shell';
  return [
    resolve(installLocation, platformPath),
    resolve(installLocation, 'chrome-mac/headless_shell'),
    resolve(installLocation, 'chrome-linux/headless_shell'),
    resolve(installLocation, 'chrome-win/headless_shell.exe'),
  ];
}

function checkPlaywright() {
  const dryRun = run('pnpm', [
    '--filter',
    '@collaborationtool/e2e',
    'exec',
    'playwright',
    'install',
    '--dry-run',
    'chromium-headless-shell',
  ]);
  if (dryRun.status !== 0) {
    record('warn', 'Playwright browsers', 'could not inspect required chromium headless shell');
    return;
  }
  const output = `${dryRun.stdout}${dryRun.stderr}`;
  const installLocation = parseChromiumHeadlessInstallLocation(output);
  if (!installLocation) {
    record('warn', 'Playwright browsers', 'could not parse chromium headless shell install location');
    return;
  }

  const executable = chromiumHeadlessExecutables(installLocation).find(isExecutable);
  if (executable) {
    record('pass', 'Playwright browsers', executable);
  } else if (existsSync(installLocation)) {
    record(
      'warn',
      'Playwright browsers',
      `cache entry exists at ${installLocation}, but headless_shell is missing; rerun \`pnpm --filter @collaborationtool/e2e exec playwright install chromium-headless-shell\``,
    );
  } else {
    record(
      'warn',
      'Playwright browsers',
      'missing chromium headless shell; run `pnpm --filter @collaborationtool/e2e exec playwright install chromium-headless-shell`',
    );
  }
}

function checkOptionalBinaries() {
  const typst = run('typst', ['--version']);
  record(
    typst.status === 0 ? 'pass' : 'warn',
    'Typst CLI',
    typst.status === 0 ? typst.stdout.trim().split('\n')[0] : 'not found; PDF export integration may be unavailable',
  );

  const bwrap = run('bwrap', ['--version']);
  record(
    bwrap.status === 0 ? 'pass' : 'warn',
    'bubblewrap',
    bwrap.status === 0 ? bwrap.stdout.trim().split('\n')[0] : 'not found; Linux sandbox dogfood skips outside Linux runners',
  );
}

function printResults() {
  const icon = { pass: 'PASS', warn: 'WARN', fail: 'FAIL' };
  for (const result of results) {
    console.log(`${icon[result.status]} ${result.label}: ${result.detail}`);
  }
  const counts = results.reduce(
    (acc, item) => {
      acc[item.status] += 1;
      return acc;
    },
    { pass: 0, warn: 0, fail: 0 },
  );
  console.log('');
  console.log(`Summary: ${counts.pass} pass, ${counts.warn} warn, ${counts.fail} fail`);
  if (counts.fail > 0) process.exitCode = 1;
}

checkCommandVersion('Node', 'node', ['--version'], 22);
checkCommandVersion('pnpm', 'pnpm', ['--version'], 10);
checkPnpmConfig();
checkDocker();
await checkDatabase();
checkPlaywright();
checkOptionalBinaries();
printResults();
