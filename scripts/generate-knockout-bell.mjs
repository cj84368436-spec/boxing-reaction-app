import {writeFile, readFile} from 'node:fs/promises';
const rate = 44100, duration = 2.2, strikes = [0, 0.32, 0.64];
// Original modal synthesis: three hammer strikes on a metal ring bell, with a shared ringing tail.
const partials = [[640,1,2.4],[1064,.55,3.1],[1480,.32,3.9],[2130,.16,6],[2930,.08,10]];
const samples = Array.from({length: Math.round(rate * duration)}, (_,i) => {
 const t=i/rate;
 let sample=0;
 for(const strike of strikes){const age=t-strike;if(age<0)continue;const attack=1-Math.exp(-age*1800);for(const [hz,gain,decay] of partials)sample+=gain*attack*Math.exp(-decay*age)*Math.sin(2*Math.PI*hz*age);}
 return sample * Math.min(1,(duration-t)/.08);
});
const peak=Math.max(...samples.map(Math.abs));
const wav=Buffer.alloc(44+samples.length*2);wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(rate,24);wav.writeUInt32LE(rate*2,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(samples.length*2,40);samples.forEach((x,i)=>wav.writeInt16LE(Math.round(x/peak*.8*32767),44+i*2));
const base=new URL('../src/app/assets/sfx/',import.meta.url);
await writeFile(new URL('knockout.wav',base),wav);
await writeFile(new URL('knockoutSfxData.ts',base),'// Original synthesized three-strike boxing bell. Regenerate with scripts/generate-knockout-bell.mjs.\nexport const KNOCKOUT_SFX_URI = '+JSON.stringify('data:audio/wav;base64,'+wav.toString('base64'))+';\n');
console.log({duration,strikes,peak:0.8,bytes:wav.length});
