#!/usr/bin/env node

import { readFile, mkdir } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { convertAsfAmc } from './convert-cmu-amc.mjs';
import { resolveVerifiedSource } from './source-integrity.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const DEFAULT_MANIFEST_PATH = join(__dirname, 'motion-sources.json');
const DEFAULT_OUTPUT_DIR = join(ROOT, 'src', 'game', 'assets', 'motion');
const DEFAULT_CACHE_DIR = join(tmpdir(), 'boxing-p0-motion-source-cache');

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

function converterOptions(source, attribution, asfPath, amcPath, outputPath) {
  return {
    asfPath,
    amcPath,
    asfSha256: source.asfSha256,
    amcSha256: source.amcSha256,
    outputPath,
    attackId: source.attackId,
    attackName: source.attackName,
    sourceId: `${source.subject}_${String(source.trial).padStart(2, '0')}`,
    asfUrl: source.asfUrl,
    amcUrl: source.amcUrl,
    attribution,
    sourceFps: source.sourceFps,
    frameStart: source.frameRange.start,
    frameEnd: source.frameRange.end,
    readyFrame: source.anchors.ready.sourceFrame,
    cueFrame: source.anchors.visualCue.sourceFrame,
    impactFrame: source.anchors.visualImpact.sourceFrame,
    recoveryFrame: source.anchors.visualRecovery.sourceFrame,
    canonicalTiming: source.canonicalTiming,
    visualRecoveryMs: source.anchors.visualRecovery.timeMsNonCanonical
  };
}

export async function rebuildMotionAssets({
  manifestPath = DEFAULT_MANIFEST_PATH,
  sourceDir,
  outputDir = DEFAULT_OUTPUT_DIR,
  cacheDir = DEFAULT_CACHE_DIR
} = {}) {
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  await mkdir(outputDir, { recursive: true });
  await mkdir(cacheDir, { recursive: true });
  const results = [];

  for (const source of manifest.sources) {
    const asfPath = await resolveVerifiedSource({
      sourceDir,
      cacheDir,
      filename: `${source.subject}.asf`,
      url: source.asfUrl,
      expectedSha256: source.asfSha256,
      label: `${source.attackId} ASF`
    });
    const amcPath = await resolveVerifiedSource({
      sourceDir,
      cacheDir,
      filename: source.sourceFilename,
      url: source.amcUrl,
      expectedSha256: source.amcSha256,
      label: `${source.attackId} AMC`
    });
    const outputPath = join(outputDir, basename(source.motionAsset));
    const asset = await convertAsfAmc(
      converterOptions(source, manifest.attribution.text, asfPath, amcPath, outputPath)
    );
    results.push({
      attackId: source.attackId,
      outputPath,
      asfPath,
      amcPath,
      asfSha256: source.asfSha256,
      amcSha256: source.amcSha256,
      frameCount: asset.frames.length
    });
  }
  return results;
}

async function main(argv) {
  const options = parseCliOptions(argv);
  const results = await rebuildMotionAssets({
    manifestPath: options.manifest ? resolve(options.manifest) : DEFAULT_MANIFEST_PATH,
    sourceDir: options['source-dir'] ? resolve(options['source-dir']) : undefined,
    outputDir: options['output-dir'] ? resolve(options['output-dir']) : DEFAULT_OUTPUT_DIR,
    cacheDir: options['cache-dir'] ? resolve(options['cache-dir']) : DEFAULT_CACHE_DIR
  });
  for (const result of results) {
    console.log(`${result.attackId}: rebuilt ${result.frameCount} frames -> ${result.outputPath}`);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main(process.argv).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
