import {resultSummary} from '../product/resultSummary';
import type {RoundRecord} from '../session/progression';
const record:RoundRecord={level:1,cleared:false,resolved:5,survived:4,lives:0,perfect:0,streak:0,reactionMs:null,at:1};
test.each([[4,5],[8,10],[14,15],[29,30]])('offers a nearby survival goal for %s', (survived,target)=>{
 expect(resultSummary({...record,survived},[]).goal).toBe(`다음 목표: ${target}번째 공격까지 버티기`);
});
test('does not invent a strength from no successful defense or an impossible 31st attack',()=>{
 expect(resultSummary(record,[]).strength).toBeNull();
 expect(resultSummary({...record,cleared:true,survived:30,perfect:30,streak:30},[]).goal).not.toMatch(/31|더 늘/);
});
test('keeps perfect streak meaning and reports observed counts only',()=>{
 const summary=resultSummary({...record,perfect:2,streak:1},[]);
 expect(summary.strength).toBe('잘한 점: 완벽 회피 2회');
});
