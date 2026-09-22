import { P0_ATTACKS } from '../../game/config/p0Attacks.js';
import { JOINT_NAMES, type ScreenPose, type ScreenPoint } from './types.js';
// Authored release-candidate performance. Original CMU/FK assets are untouched.
// Fixed waist-up composition; a shared ready pose avoids clip-to-clip camera jumps.
const smooth=(x:number)=>{const t=Math.max(0,Math.min(1,x));return t*t*(3-2*t);};
const p=(x:number,y:number,scale=1,depth=0):ScreenPoint=>({x,y,scale,depth});
const mix=(a:ScreenPoint,b:ScreenPoint,t:number):ScreenPoint=>p(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t,a.scale+(b.scale-a.scale)*t,a.depth+(b.depth-a.depth)*t);
export function candidateCombatPose(attackId:string,elapsedMs:number):ScreenPose {
 const attack=P0_ATTACKS[attackId as keyof typeof P0_ATTACKS];
 const hook=attack.punchType==='HOOK',rear=attack.hand==='REAR';
 const cue=attack.cueAnchorMs,impact=attack.impactMs;
 const ready=Object.fromEntries(JOINT_NAMES.map(name=>[name,p(140,470)])) as unknown as ScreenPose;
 Object.assign(ready,{head:p(140,101),neck:p(140,145),chest:p(140,220),pelvis:p(140,328),
  lShoulder:p(187,178),rShoulder:p(93,178),lElbow:p(210,245),rElbow:p(69,243),lHand:p(190,143),rHand:p(94,153),
  lHip:p(170,355),rHip:p(110,355),lKnee:p(176,620),rKnee:p(105,620)});
 const prep=hook?{hand:p(239,153,1),elbow:p(232,226)}:rear?{hand:p(75,155,.94),elbow:p(65,251)}:{hand:p(191,140,1),elbow:p(211,243)};
 const contact=hook?{hand:p(140,165,1.5,2),elbow:p(229,173,1.1)}:rear?{hand:p(140,165,1.5,2),elbow:p(93,192,1.1)}:{hand:p(140,165,1.4,2),elbow:p(178,194,1.05)};
 const handKey=rear?'rHand':'lHand',elbowKey=rear?'rElbow':'lElbow';
 let hand=ready[handKey],elbow=ready[elbowKey],turn=0;
 const launch=cue+(impact-cue)*(hook?.48:rear?.37:.15);
 if(elapsedMs<=launch){const t=smooth(elapsedMs/Math.max(1,launch));hand=mix(hand,prep.hand,t);elbow=mix(elbow,prep.elbow,t);turn=(rear?-9:hook?9:2)*t;}
 else if(elapsedMs<=impact){const t=smooth((elapsedMs-launch)/(impact-launch));hand=mix(prep.hand,contact.hand,t);elbow=mix(prep.elbow,contact.elbow,t);if(hook)hand={...hand,y:hand.y-26*Math.sin(Math.PI*t)};turn=(rear?-9:hook?9:2)*(1-t)+(rear?10:hook?-11:-3)*t;}
 else {const t=smooth((elapsedMs-impact)/260);hand=mix(contact.hand,hand,t);elbow=mix(contact.elbow,elbow,t);turn=(rear?10:hook?-11:-3)*(1-t);}
 return {...ready,head:p(140+turn*.6,101+Math.abs(turn)*.15),neck:p(140+turn*.5,145),chest:p(140+turn,220),lShoulder:p(187+turn,178-turn*.25),rShoulder:p(93+turn,178+turn*.25),[handKey]:hand,[elbowKey]:elbow};
}
