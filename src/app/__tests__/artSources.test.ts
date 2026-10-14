import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {Image} from 'react-native';

it('delivers every original PNG as a resolvable URI with the original dimensions', () => {
  const {ART_SOURCES} = require('../assets/artSources');
  const files = {jab:'jab',straight:'straight',hook:'hook',uppercut:'uppercut',coach:'coach-skinny',gloves:'gloves-high-guard',gym:'gym'};
  expect(Object.keys(ART_SOURCES).sort()).toEqual(Object.keys(files).sort());
  for (const [key,file] of Object.entries(files)) {
    const original=readFileSync(resolve(__dirname,`../assets/art/${file}.png`));
    const source=ART_SOURCES[key];
    expect(source.uri.startsWith('data:image/png;base64,')).toBe(true);
    expect(Buffer.from(source.uri.split(',')[1],'base64').equals(original)).toBe(true);
    expect(source.width).toBe(original.readUInt32BE(16));
    expect(source.height).toBe(original.readUInt32BE(20));
    expect(Image.resolveAssetSource(source)).toEqual(source);
  }
});
