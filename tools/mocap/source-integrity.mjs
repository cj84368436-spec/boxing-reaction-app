import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { access, mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { spawn } from 'node:child_process';

const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

async function fileExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

export async function sha256File(path) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
}

export async function verifySourceFile(path, expectedSha256, label = path) {
  if (!SHA256_PATTERN.test(expectedSha256)) {
    throw new Error(`Invalid expected SHA-256 for ${label}`);
  }

  const actualSha256 = await sha256File(path);
  if (actualSha256 !== expectedSha256) {
    throw new Error(
      `SHA-256 mismatch for ${label}: expected ${expectedSha256}, got ${actualSha256}`
    );
  }
  return actualSha256;
}

export function assertHttpsUrl(value) {
  const url = value instanceof URL ? value : new URL(value);
  if (url.protocol !== 'https:') throw new Error(`HTTPS URL required: ${url}`);
  return url;
}

async function downloadWithNode(url, destination) {
  let currentUrl = assertHttpsUrl(url);
  for (let redirects = 0; redirects <= 5; redirects += 1) {
    const response = await fetch(currentUrl, { redirect: 'manual' });
    if (REDIRECT_STATUSES.has(response.status)) {
      const location = response.headers.get('location');
      if (!location) throw new Error(`Redirect without Location for ${currentUrl}`);
      currentUrl = assertHttpsUrl(new URL(location, currentUrl));
      continue;
    }
    if (!response.ok) throw new Error(`HTTP ${response.status} for ${currentUrl}`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    await writeFile(destination, bytes);
    return;
  }
  throw new Error(`Too many HTTPS redirects for ${url}`);
}

async function downloadWithCurl(url, destination) {
  const secureUrl = assertHttpsUrl(url);
  const executable = process.platform === 'win32' ? 'curl.exe' : 'curl';
  await new Promise((resolve, reject) => {
    const child = spawn(executable, [
      '--fail',
      '--location',
      '--silent',
      '--show-error',
      '--proto',
      '=https',
      '--proto-redir',
      '=https',
      '--output',
      destination,
      secureUrl.href
    ], { stdio: ['ignore', 'ignore', 'pipe'] });
    let errorOutput = '';
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk) => { errorOutput += chunk; });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`curl exited ${code}: ${errorOutput.trim()}`));
    });
  });
}

export async function downloadVerifiedSource({ url, destination, expectedSha256, label }) {
  await mkdir(dirname(destination), { recursive: true });
  const temporary = `${destination}.part-${process.pid}`;
  await rm(temporary, { force: true });

  let nodeError;
  try {
    await downloadWithNode(url, temporary);
  } catch (error) {
    nodeError = error;
    await rm(temporary, { force: true });
    try {
      await downloadWithCurl(url, temporary);
    } catch (curlError) {
      throw new Error(
        `Secure download failed for ${label}. Node: ${nodeError.message}. ` +
        `curl: ${curlError.message}. Provide verified local files with --source-dir.`
      );
    }
  }

  try {
    await verifySourceFile(temporary, expectedSha256, label);
    await rm(destination, { force: true });
    await rename(temporary, destination);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
  return destination;
}

export async function resolveVerifiedSource({
  sourceDir,
  cacheDir,
  filename,
  url,
  expectedSha256,
  label
}) {
  const candidates = [sourceDir && join(sourceDir, filename), join(cacheDir, filename)].filter(Boolean);
  for (const candidate of candidates) {
    if (await fileExists(candidate)) {
      await verifySourceFile(candidate, expectedSha256, label);
      return candidate;
    }
  }

  return downloadVerifiedSource({
    url,
    destination: join(cacheDir, filename),
    expectedSha256,
    label
  });
}
