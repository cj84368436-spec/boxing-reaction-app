import { candidatePatterns } from './candidateRules.js';
import { CHAMPION_UPPERCUT } from './championRules.js';
import type { ComboDefinition } from '../../game/model/types.js';
export type Level = 1 | 2 | 3;
export const SURVIVAL_PUNCHES = 30;
export const SURVIVAL_LIVES = 5;
export const LEVELS = {1:{name:'입문',rate:0.65},2:{name:'도전자',rate:1},3:{name:'챔피언',rate:1.12}} as const;
export function survivalPatterns(seed: number, level: Level): readonly ComboDefinition[] {
 const first=candidatePatterns(seed), middle=candidatePatterns(seed+1), last=candidatePatterns(seed+2);
 const phases=[first,[middle[3]!,middle[4]!,middle[5]!,last[5]!],[last[0]!,last[5]!,middle[5]!,first[5]!]];
 return phases.flatMap((phase,stage)=>phase.map((combo,i)=>({
  ...combo,
  attacks: level===3 && stage===2 && i===(seed>>>0)%phase.length ? combo.attacks.map((attack,index)=>index===0?CHAMPION_UPPERCUT:attack) : combo.attacks,
  comboId:'phase-'+stage+'-'+i+'-'+combo.comboId,
  recoveryAfterMs:Math.max(650,combo.recoveryAfterMs-(level-1)*70-stage*30)
 })));
}
