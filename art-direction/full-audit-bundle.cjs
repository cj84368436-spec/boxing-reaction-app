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
    scope:'actual AIT original assets, shared short-arena fit, intact cuffs and connected forearms, inactive-ad return pause, bounded progress read, audio isolation, guide and records; physical-device display/audio remains pending',bundles:[]};
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

    function readVariable(name) {
      const marker = 'var ' + name + ' = ';
      const begin = source.indexOf(marker);
      assert(begin >= 0, entry + ': missing ' + name);
      return source.slice(begin + marker.length, source.indexOf(';\n', begin));
    }
    const wavSources = vm.runInNewContext('(' + readVariable('PLAYTEST_SFX_DATA_URIS') + ')');
    wavSources.knockout = vm.runInNewContext('(' + readVariable('KNOCKOUT_SFX_URI') + ')');
    const html = vm.runInNewContext('(' + readVariable('SFX_HTML_SOURCE') + ')', {sounds:wavSources}).html;
    assert(html.includes('new Audio(sources[name])') && html.includes('visibilitychange'));
    assert.equal(Object.keys(wavSources).length,8);
    for (const [name,uri] of Object.entries(wavSources)) {
      assert(Buffer.from(uri.split(',')[1],'base64').equals(fs.readFileSync(path.join(root,'src/app/assets/sfx',name+'.wav'))));
    }
    const player = source.slice(source.indexOf('function TemporarySfxPlayer('),source.indexOf('function TemporarySfxPlayer(')+7000);
    assert(/jsx\)\((react_native_webview_exports|import_react_native_webview\d*)\.WebView,/.test(player), entry + ': named WebView export missing');
    assert(player.includes('mediaPlaybackRequiresUserAction: false') && player.includes('source: SFX_HTML_SOURCE'));
    assert(!player.includes('ignoreSilentSwitch: "obey"'));
    const sprite = source.slice(source.indexOf('function SpriteImage('),source.indexOf('function SpriteImage(')+2200);
    assert(/jsx\)\(import_react_native_svg\d*\.G,/.test(sprite));
    assert(sprite.includes('transform:') && sprite.includes('translate('));
    const rig=source.slice(source.indexOf('function BoxerRig('),source.indexOf('function BoxerRig(')+5500);
    assert(rig.includes('COMBAT_VIEW.width * height / width'));
    assert(rig.includes('Math.max(360,')&&rig.includes('heightInScene * width / height'));
    assert.equal((rig.match(/preserveAspectRatio: "xMidYMin meet"/g)||[]).length,2);
    assert.equal((rig.match(/viewBox,/g)||[]).length,2);
    assert(rig.includes('viewportHeight'));
    assert(!rig.includes('preserveAspectRatio: "xMidYMax meet"')&&!rig.includes('preserveAspectRatio: "xMidYMid slice"'));
    const glove=source.slice(source.indexOf('function PlayerGlove('),source.indexOf('function PlayerDefenseFeedback('));
    assert(glove.includes('cuffBottom')&&glove.includes('handHeight')&&glove.includes('viewportHeight + 8 - armY'));
    assert(glove.includes('preserveAspectRatio: "none"')&&glove.includes('preserveAspectRatio: "xMidYMid meet"'));
    assert(/jsx\)\(import_react_native_svg\d*\.Svg,/.test(glove));
    assert(/jsx\)\(import_react_native_svg\d*\.Image,/.test(glove));
    assert(source.includes('var gloveWidth = 160')&&source.includes('var cuffBottom = 860'));
    assert(source.includes('PROGRESS_LOAD_TIMEOUT_MS = 8e3'));
    const begin=source.slice(source.indexOf('var begin = '),source.indexOf('var beginDaily = '));
    assert(begin.includes('!foregroundRef.current')&&begin.includes('clockRef.current.pause()')&&begin.includes('pausedRef.current = true'));
    for(const id of ['ait.v2.live.0a25ead0c3b642ae','ait.v2.live.0afa67d9d8934138','ait.v2.live.1dae02e06eca49ee'])assert(source.includes(id));
    assert(!source.includes('ait.dev.')&&!source.includes('ait.v2.test.'));
    assert(/containerStyle: \w+\.hiddenContainer/.test(player));
    assert(/hiddenContainer: \{[^}]*position: "absolute"[^}]*height: 1[^}]*flex: 0/.test(source));
    assert(/introContent: \{[^}]*justifyContent: "flex-start"/.test(source));
    assert(source.includes('lineBreakStrategyIOS: "hangul-word"'));
    for (const text of ['잽 → 왼쪽 또는 오른쪽','스트레이트 → 왼쪽','훅 → 오른쪽']) {
      const encoded=text.replace(/[^\x00-\x7F]/g,char=>'\\u'+char.charCodeAt(0).toString(16).toUpperCase().padStart(4,'0'));
      assert(source.includes(text) || source.includes(encoded),entry+': missing guide text');
    }

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
  fs.writeFileSync(path.join(__dirname,'full-audit-bundle-20261013.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({deploymentId:report.deploymentId,bytes:report.bytes,sha256:report.sha256,bundles:report.bundles.length,imagesPerBundle:7,preserved:preserved.length}));
})().catch(error=>{console.error(error);process.exitCode=1;});




