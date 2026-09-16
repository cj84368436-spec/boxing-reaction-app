#!/usr/bin/env node

import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { rebuildMotionAssets } from './rebuild-motion-assets.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const MANIFEST_PATH = join(__dirname, 'motion-sources.json');

function xyzEqual(committed, rebuilt) {
  if (committed.frames.length !== rebuilt.frames.length) return false;
  for (let frameIndex = 0; frameIndex < committed.frames.length; frameIndex += 1) {
    const committedFrame = committed.frames[frameIndex];
    const rebuiltFrame = rebuilt.frames[frameIndex];
    for (const joint of committed.jointNames) {
      if (!isDeepStrictEqual(committedFrame.joints[joint], rebuiltFrame.joints[joint])) return false;
    }
  }
  return true;
}

export function compareMotionAssets(committed, rebuilt) {
  const comparison = {
    frameCount: committed.frames.length === rebuilt.frames.length,
    sourceFrames: isDeepStrictEqual(
      committed.frames.map((frame) => frame.sourceFrame),
      rebuilt.frames.map((frame) => frame.sourceFrame)
    ),
    jointNames: committed.jointNames.length === 19 && isDeepStrictEqual(committed.jointNames, rebuilt.jointNames),
    xyz: xyzEqual(committed, rebuilt),
    canonicalTiming: isDeepStrictEqual(committed.canonicalTiming, rebuilt.canonicalTiming),
    animationAnchors: isDeepStrictEqual(
      {
        selection: committed.selection,
        timeline: committed.timeline,
        visualRecoveryMs: committed.visualRecoveryMs
      },
      {
        selection: rebuilt.selection,
        timeline: rebuilt.timeline,
        visualRecoveryMs: rebuilt.visualRecoveryMs
      }
    )
  };
  return { ...comparison, equal: Object.values(comparison).every(Boolean) };
}

function parseCliOptions(argv) {
  const options = {};
  for (let index = 2; index < argv.length; index += 2) {
    const flag = argv[index];
    if (!flag?.startsWith('--')) throw new Error(`Unexpected argument: ${flag}`);
    const value = argv[index + 1];
    if (!value) throw new Error(`Missing value for ${flag}`);
    options[flag.slice(2)] = value;
  }
  return options;
}

export async function auditMotionAssets({ sourceDir } = {}) {
  const temporaryRoot = await mkdtemp(join(tmpdir(), 'boxing-motion-audit-'));
  const outputDir = join(temporaryRoot, 'rebuilt');
  const cacheDir = join(temporaryRoot, 'sources');
  try {
    const manifest = JSON.parse(await readFile(MANIFEST_PATH, 'utf8'));
    const rebuilt = await rebuildMotionAssets({
      manifestPath: MANIFEST_PATH,
      sourceDir,
      outputDir,
      cacheDir
    });
    const results = [];
    for (const source of manifest.sources) {
      const rebuiltResult = rebuilt.find((result) => result.attackId === source.attackId);
      const committedAsset = JSON.parse(await readFile(join(ROOT, source.motionAsset), 'utf8'));
      const rebuiltAsset = JSON.parse(await readFile(rebuiltResult.outputPath, 'utf8'));
      results.push({
        attackId: source.attackId,
        comparison: compareMotionAssets(committedAsset, rebuiltAsset),
        asfSha256: rebuiltResult.asfSha256,
        amcSha256: rebuiltResult.amcSha256
      });
    }
    return results;
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}

async function main(argv) {
  const options = parseCliOptions(argv);
  const results = await auditMotionAssets({
    sourceDir: options['source-dir'] ? resolve(options['source-dir']) : undefined
  });
  for (const result of results) {
    const details = Object.entries(result.comparison)
      .filter(([key]) => key !== 'equal')
      .map(([key, value]) => `${key}=${value ? 'PASS' : 'FAIL'}`)
      .join(', ');
    console.log(`${result.attackId}: ${result.comparison.equal ? 'PASS' : 'FAIL'} (${details})`);
    console.log(`  ASF sha256=${result.asfSha256}`);
    console.log(`  AMC sha256=${result.amcSha256}`);
  }
  if (results.some((result) => !result.comparison.equal)) process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main(process.argv).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
