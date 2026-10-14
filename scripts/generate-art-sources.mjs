import {readFileSync, writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

// Granite excludes local PNG imports. Embed original bytes as URI sources;
// no artwork conversion or dependency on an external image host is involved.
const directory = new URL('../src/app/assets/', import.meta.url);
const files = {jab:'jab',straight:'straight',hook:'hook',uppercut:'uppercut',coach:'coach-skinny',gloves:'gloves-high-guard',gym:'gym'};
const sources = {};
for (const [key,file] of Object.entries(files)) {
  const png = readFileSync(new URL(`art/${file}.png`, directory));
  if (png.subarray(0,8).toString('hex') !== '89504e470d0a1a0a') throw new Error(`Invalid PNG: ${file}`);
  sources[key] = {uri:`data:image/png;base64,${png.toString('base64')}`,
    width:png.readUInt32BE(16),height:png.readUInt32BE(20),scale:1};
}
const target = new URL('artSources.generated.json', directory);
const contents = JSON.stringify(sources);
let previous;
try { previous=readFileSync(target,'utf8'); } catch (error) { if (error.code!=='ENOENT') throw error; }
if (contents !== previous) writeFileSync(target, contents);
console.log(`Verified ${Object.keys(sources).length} original PNG sources: ${fileURLToPath(target)}`);
