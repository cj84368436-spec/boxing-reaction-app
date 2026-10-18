import {buildViralResultPresentation} from '/.preview-dist/app/product/viralResultPresentation.js';
/** Browser-only rendering of the same native presentation. Does not write game state. */
export function renderViralResult(input){
 const p=buildViralResultPresentation(input);if(!p)return;
 const el=id=>document.getElementById(id);
 el('result-brand').textContent=p.title+' · '+p.difficulty;
 el('result-headline').textContent=p.headline;
 el('result-title').textContent=p.resultText;
 el('result-caption').textContent=p.resultCaption+' · '+p.perfectText;
 el('coach-result').textContent='관장: “'+p.coachLine+'”';
 el('recent-comparison').hidden=!p.comparisonText;
 el('recent-comparison').textContent=p.comparisonText?p.previousLabel+(p.comparisonDelta?' · '+p.comparisonDelta:'')+'\n'+p.comparisonText:'';
 el('record-title').textContent=p.bestText;el('record-title').classList.toggle('is-best',p.isPersonalBest);
 el('nearby-goal').textContent=p.goal;el('viral-prompt').textContent=p.viralPrompt;
 el('share-result-button').textContent=p.shareButtonLabel;
 el('viral-header').classList.toggle('is-clear',input.record.cleared);
}
