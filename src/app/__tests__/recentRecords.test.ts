import {emptyProgress,parseProgressWithStatus,recordRound,type RoundRecord} from '../session/progression';
import {recordRecentRound,isCompletedRecentRecord} from '../product/recentRecords';
const ko=(survived:number,level:1|2|3=1):RoundRecord=>({level,cleared:false,resolved:survived+1,survived,lives:0,perfect:0,streak:0,reactionMs:null,at:1});

test('old v1 loads without recent, damage, or changes to best records',()=>{
 const old=recordRound(emptyProgress(),ko(20));
 const parsed=parseProgressWithStatus(JSON.stringify(old));
 expect(parsed.damaged).toBe(false);expect(parsed.progress).toEqual(old);
 expect(parsed.progress.recentByDifficulty?.[1]).toBeUndefined();
});
test('only the most recent completed round per difficulty persists independently from best',()=>{
 const best=ko(20);let progress=recordRound(emptyProgress(),best);
 progress=recordRecentRound(progress,ko(8));const previous=progress.recentByDifficulty?.[1];
 progress=recordRecentRound(recordRound(progress,ko(12)),ko(12));
 progress=recordRecentRound(progress,ko(6,2));
 expect(previous?.survived).toBe(8);expect(progress.best[1]).toEqual(best);
 expect(progress.recentByDifficulty?.[1]?.survived).toBe(12);
 expect(progress.recentByDifficulty?.[2]?.survived).toBe(6);
 expect(progress.recentByDifficulty?.[3]).toBeUndefined();
 expect(parseProgressWithStatus(JSON.stringify(progress))).toEqual({progress,damaged:false});
});
test.each([{},null,[],{...ko(4),resolved:0},{...ko(4),survived:30},{...ko(4),lives:2},{...ko(4),perfect:6},{...ko(4),streak:1},{...ko(4),resolved:5.5},{...ko(4),cleared:true},{...ko(4),at:NaN}])('rejects incomplete or inconsistent recent records: %j',record=>{
 expect(isCompletedRecentRecord(record,1)).toBe(false);
 if(record){const p=emptyProgress();expect(recordRecentRound(p,record as RoundRecord)).toBe(p);}
});
test('a valid clear is saved but preview best-only updates cannot create recent',()=>{
 const clear={...ko(29),cleared:true,survived:30,lives:2,perfect:12,streak:3};
 expect(isCompletedRecentRecord(clear,1)).toBe(true);
 expect(recordRecentRound(emptyProgress(),clear).recentByDifficulty?.[1]).toEqual(clear);
 expect(recordRound(emptyProgress(),clear).recentByDifficulty).toBeUndefined();
});
test('damaged recent is isolated, valid best and other difficulty remain recoverable',()=>{
 const p=recordRound(emptyProgress(),ko(20));
 const raw=JSON.stringify({...p,recentByDifficulty:{1:{...ko(8),level:3},2:ko(6,2)}});
 const result=parseProgressWithStatus(raw);
 expect(result.damaged).toBe(true);expect(result.progress.best).toEqual(p.best);
 expect(result.progress.recentByDifficulty?.[1]).toBeUndefined();expect(result.progress.recentByDifficulty?.[2]).toEqual(ko(6,2));
 expect(parseProgressWithStatus(JSON.stringify({...p,recentByDifficulty:[]})).damaged).toBe(true);
});
