const {AITReader}=require('@apps-in-toss/ait-format');
const fs=require('node:fs');
(async()=>{const reader=AITReader.fromBuffer(fs.readFileSync('boxing-talent-test.ait'));const entry=reader.listEntries().find(x=>x.endsWith('.js'));const source=Buffer.from(await reader.readEntry(entry)).toString();for(const marker of ['function SpriteImage','function PlayerDefenseFeedback','var SFX_HTML_SOURCE','function TemporarySfxPlayer','sfx-web-player','introDirection']){const start=source.indexOf(marker);console.log(marker,source.slice(start-120,start+700));}})();


