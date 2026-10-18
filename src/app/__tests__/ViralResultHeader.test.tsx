import React from 'react';
import {render,screen} from '@testing-library/react-native';
import {ViralResultHeader} from '../components/ViralResultHeader';
import {buildViralResultPresentation} from '../product/viralResultPresentation';
import {buildRecentComparison} from '../product/recentComparison';
import {buildShareResult} from '../sharing/shareResult';
import type {RoundRecord} from '../session/progression';
const ko=(n:number):RoundRecord=>({level:1,cleared:false,resolved:n+1,survived:n,lives:0,perfect:0,streak:0,reactionMs:null,at:1});
const clear=(perfect:number):RoundRecord=>({...ko(29),cleared:true,survived:30,lives:3,perfect});
test.each([
 ['first',ko(4),undefined,undefined],['improved',ko(14),ko(8),ko(20)],['declined',ko(12),ko(17),ko(20)],
 ['best',ko(18),ko(14),ko(17)],['clear',clear(12),ko(24),undefined],['clear-best',clear(12),clear(10),clear(10)],
] as const)('%s screen and outgoing payload present the same actual result',(name,record,previous,previousBest)=>{
 const comparison=buildRecentComparison(previous,record),presentation=buildViralResultPresentation({record,previousBest,comparison,results:[]})!;
 render(<ViralResultHeader presentation={presentation}/>);
 expect(screen.getByTestId('viral-result-score')).toHaveTextContent(presentation.resultText);
 const shared=buildShareResult({record,...(previousBest?{previousBest}:{}),comparison})!;
 expect(shared.text).toContain(presentation.resultText);expect(shared.text).toContain(presentation.perfectText);
 expect(shared.isPersonalBest).toBe(presentation.isPersonalBest);
 expect(screen.getByTestId('viral-coach-line')).toHaveTextContent(new RegExp(presentation.coachLine));
 if(comparison){expect(screen.getByTestId('recent-comparison')).toHaveTextContent(new RegExp(comparison.message));}
 else expect(screen.queryByTestId('recent-comparison')).toBeNull();
 if(name==='first')expect(screen.queryByText('새로운 최고 기록!')).toBeNull();
 if(name==='clear-best')expect(screen.getAllByText('새로운 최고 기록!')).toHaveLength(1);
});
