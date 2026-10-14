import {KNOCKOUT_SFX_URI} from './knockoutSfxData';
import {PLAYTEST_SFX_DATA_URIS} from './playtestSfxData';

// Self-contained audio document: no network, controls, video, or microphone.
const sounds = {...PLAYTEST_SFX_DATA_URIS, knockout: KNOCKOUT_SFX_URI};
export const SFX_HTML_SOURCE = {html: `<!doctype html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; media-src data:">
</head><body><script>
(function () {
  var sources = ${JSON.stringify(sounds)};
  var players = {};
  var current = null;
  var currentId = null;
  function report(type, id) {
    window.ReactNativeWebView.postMessage(JSON.stringify({type: type, id: id}));
  }
  Object.keys(sources).forEach(function (name) {
    var audio = new Audio(sources[name]);
    audio.preload = 'auto';
    audio.volume = 0.7;
    audio.setAttribute('playsinline', '');
    audio.setAttribute('webkit-playsinline', '');
    players[name] = audio;
  });
  window.stopBoxingSound = function () {
    if (current) {
      current.pause();
      current.onplaying = current.onerror = null;
      current.currentTime = 0;
    }
    current = null;
    currentId = null;
  };
  window.playBoxingSound = function (id, name) {
    window.stopBoxingSound();
    if (!players[name] || document.hidden) return;
    var audio = players[name];
    current = audio;
    currentId = id;
    audio.onplaying = function () {if (currentId === id) report('playing', id);};
    audio.onerror = function () {if (currentId === id) {window.stopBoxingSound(); report('error', id);}};
    try {
      var result = audio.play();
      if (result && result.catch) result.catch(function () {
        if (currentId === id) {window.stopBoxingSound(); report('error', id);}
      });
    } catch (error) {window.stopBoxingSound(); report('error', id);}
  };
  document.addEventListener('visibilitychange', function () {if (document.hidden) window.stopBoxingSound();});
  window.addEventListener('pagehide', window.stopBoxingSound);
  report('ready');
})();
</script></body></html>`};
