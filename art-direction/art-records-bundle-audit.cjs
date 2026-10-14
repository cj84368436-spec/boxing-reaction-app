const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {AITReader}=require('@apps-in-toss/ait-format');
const root=path.resolve(__dirname,'..');
const files={jab:'jab',straight:'straight',hook:'hook',uppercut:'uppercut',coach:'coach-skinny',gloves:'gloves',gym:'gym'};
const hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
(async()=>{
  const bytes=fs.readFileSync(path.join(root,'boxing-talent-test.ait'));
  const reader=AITReader.fromBuffer(bytes);
  const report={deploymentId:reader.deploymentId,bytes:bytes.length,sha256:hash(bytes),
    scope:'actual AIT image source expressions and SDK container wiring; physical-device decoding/display remains pending',bundles:[]};
  for(const entry of reader.listEntries().filter(name=>name.endsWith('.js'))){
    const source=Buffer.from(await reader.readEntry(entry)).toString('utf8');
    const marker='var artSources_generated_default = ';
    const start=source.indexOf(marker);
    assert(start>=0,`${entry}: artwork sources missing`);
    const end=source.indexOf(';\n',start);
    assert(end>start);
    const sources=vm.runInNewContext(`(${source.slice(start+marker.length,end)})`);
    assert.deepEqual(Object.keys(sources).sort(),Object.keys(files).sort());
    const images=[];
    for(const [key,file] of Object.entries(files)){
      const original=fs.readFileSync(path.join(root,`src/app/assets/art/${file}.png`));
      const value=sources[key];
      assert(value.uri.startsWith('data:image/png;base64,'));
      assert(Buffer.from(value.uri.split(',')[1],'base64').equals(original));
      assert.equal(value.width,original.readUInt32BE(16));
      assert.equal(value.height,original.readUInt32BE(20));
      images.push({key,width:value.width,height:value.height,bytes:original.length,sha256:hash(original)});
    }
    assert(source.includes('var ART_SOURCES = artSources_generated_default;'));
    for(const expression of ['var sheets = ART_SOURCES','ART_SOURCES.coach','ART_SOURCES.gloves','source: ART_SOURCES.gym'])assert(source.includes(expression),`${entry}: missing ${expression}`);
    assert(!/"src\/app\/assets\/art\/.+\.png"\(\)/.test(source),'Empty local asset module remains');
    const records=source.slice(source.indexOf('recordsOpen ?'),source.indexOf('recordsOpen ?')+12000);
    assert(/jsxs\)\(IOScrollView_default,/.test(records),'Records must mount the real observer scroll container');
    assert(source.includes('throw new IOProviderMissingError()'),'Expected real SDK provider check');
    assert(source.includes('./_404.tsx')&&source.includes('./index.tsx'),'Entry and fallback routes missing');
    const map=JSON.parse(Buffer.from(await reader.readEntry(`${entry}.map`)).toString('utf8'));
    assert(map.sources.length>0&&map.mappings.length>0,'Source mappings must remain');
    assert(!map.sourcesContent,'Source map must not duplicate embedded artwork');
    report.bundles.push({entry,bundleBytes:Buffer.byteLength(source),images,recordsObserverContainer:true,sourceMappingsPreserved:true});
  }
  assert.equal(report.bundles.length,4);
  const baseline=path.resolve(root,'../../entry-diagnostics/20261013-c');
  const preserved=[];
  function compare(directory){
    for(const item of fs.readdirSync(path.join(root,directory),{withFileTypes:true})){
      const relative=path.join(directory,item.name);
      if(item.isDirectory())compare(relative);
      else{assert(fs.readFileSync(path.join(root,relative)).equals(fs.readFileSync(path.join(baseline,relative))),`Protected original changed: ${relative}`);preserved.push(relative);}
    }
  }
  for(const directory of ['src/game','tests','tools/mocap','src/app/assets/art'])compare(directory);
  report.preservedOriginalFiles=preserved;
  fs.writeFileSync(path.join(__dirname,'art-records-bundle-audit-20261013.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({deploymentId:report.deploymentId,bytes:report.bytes,sha256:report.sha256,bundles:report.bundles.length,imagesPerBundle:7,preserved:preserved.length}));
})().catch(error=>{console.error(error);process.exitCode=1;});
