import {runInNewContext} from 'node:vm';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {SFX_HTML_SOURCE} from '../assets/sfx/sfxPlayerHtml';

function setup() {
  const players: any[] = [];
  const messages: any[] = [];
  const events: Record<string, () => void> = {};
  const document = {hidden:false, addEventListener:(event: string, callback: () => void) => {events[event] = callback;}};
  const window: any = {ReactNativeWebView:{postMessage:(message: string) => messages.push(JSON.parse(message))}, addEventListener:document.addEventListener};
  class Audio {
    src: string; currentTime = 0; onplaying: any; onerror: any;
    pause = jest.fn(); play = jest.fn(() => {this.onplaying?.(); return Promise.resolve();}); setAttribute = jest.fn();
    constructor(src: string) {this.src = src; players.push(this);}
  }
  runInNewContext(SFX_HTML_SOURCE.html.match(/<script>([\s\S]*?)<\/script>/)![1]!, {window, document, Audio});
  return {players, messages, events, window, document};
}

it('embeds all eight original WAV files and starts without network requests', () => {
  const {players, messages} = setup();
  expect(players).toHaveLength(8);
  for (const player of players) {
    const wav = Buffer.from(player.src.split(',')[1], 'base64');
    expect(wav.subarray(0,4).toString()).toBe('RIFF');
    expect(wav.subarray(8,12).toString()).toBe('WAVE');
    const names = ['evade','guard','hit','hitJab','hitStraight','hitHook','recognition','knockout'];
    expect(names.some(name => readFileSync(resolve(__dirname, '../assets/sfx', name + '.wav')).equals(wav))).toBe(true);
  }
  expect(messages).toEqual([{type:'ready'}]);
  expect(SFX_HTML_SOURCE.html).toContain("media-src data:");
});

it('stops the previous sound on the next punch and silences a hidden page', () => {
  const {window, players, messages, document, events} = setup();
  window.playBoxingSound('one','hit');
  expect(messages.at(-1)).toEqual({type:'playing',id:'one'});
  const previous = players.find(player => player.play.mock.calls.length === 1);
  window.playBoxingSound('two','knockout');
  expect(previous.pause).toHaveBeenCalled();
  expect(messages.at(-1)).toEqual({type:'playing',id:'two'});
  document.hidden = true; events.visibilitychange!();
  const bell = players.find(player => player.play.mock.calls.length === 1 && player !== previous);
  expect(bell.pause).toHaveBeenCalled();
  window.playBoxingSound('hidden','guard');
  expect(messages.some(message => message.id === 'hidden')).toBe(false);
});

it('reports play rejection and ignores rejection from an interrupted sound', async () => {
  const {window, players, messages} = setup();
  players.forEach(player => player.play.mockImplementation(() => Promise.reject(new Error('decoder'))));
  window.playBoxingSound('old','hit'); window.playBoxingSound('current','guard');
  await Promise.resolve();
  expect(messages.filter(message => message.type === 'error')).toEqual([{type:'error',id:'current'}]);
});
