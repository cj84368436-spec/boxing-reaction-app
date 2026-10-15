// Explicit QA-only native port. No SDK/advertising network is used here.
import {RewardedRetryAdController,type FullScreenAdPort} from '../../src/app/ads/rewardedRetryAd';
import {StageInterstitialAdController} from '../../src/app/ads/stageInterstitialAd';
import type {AdEventObserver} from '../../src/app/ads/adEvents';
export function createQaAds(observer:AdEventObserver) {
  const port=(format:'rewarded'|'interstitial'):FullScreenAdPort=>({
    isLoadSupported:()=>true,isShowSupported:()=>true,
    load:({onEvent})=>{let active=true;queueMicrotask(()=>{if(active)onEvent({type:'loaded'});});return ()=>{active=false;};},
    show:({onEvent})=>{
      const modal=document.createElement('section');modal.id='qa-ad';modal.setAttribute('role','dialog');modal.setAttribute('aria-label','DEV 광고 모의');
      Object.assign(modal.style,{position:'fixed',inset:'0',zIndex:'1000',background:'#14262a',color:'white',padding:'40px 20px',display:'flex',flexDirection:'column',gap:'20px'});
      const title=document.createElement('h2');title.textContent=`DEV PREVIEW · ${format} 광고 모의`;modal.append(title);
      const note=document.createElement('p');note.textContent='실제 토스 광고가 아닙니다. native callback 계약을 테스트합니다.';modal.append(note);
      function button(id:string,label:string,action:()=>void){const el=document.createElement('button');el.id=id;el.textContent=label;el.onclick=action;modal.append(el);}
      if(format==='rewarded')button('qa-ad-reward','보상 이벤트',()=>onEvent({type:'userEarnedReward',data:{unitType:'retry',unitAmount:1}}));
      button('qa-ad-dismiss','닫힘 이벤트',()=>{modal.remove();onEvent({type:'dismissed'});});
      button('qa-ad-fail','표시 실패 이벤트',()=>{modal.remove();onEvent({type:'failedToShow'});});
      document.body.append(modal);onEvent({type:'show'});
      return ()=>modal.remove();
    },
  });
  return {rewarded:new RewardedRetryAdController(port('rewarded'),undefined,observer),stage:new StageInterstitialAdController(port('interstitial'),undefined,observer)};
}
