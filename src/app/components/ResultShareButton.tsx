import {RESULT_SHARE_LABEL} from '../product/viralResultPresentation';
import React,{useEffect,useRef,useState} from 'react';
import {Pressable,StyleSheet,View} from 'react-native';
import {Text} from './GameText';
import type {RoundRecord} from '../session/progression';
import type {RecentComparison} from '../product/recentComparison';
import type {PlayRuntime} from '../product/playRuntime';
import {buildShareResult} from '../sharing/shareResult';
import type {ResultShareAdapter,ShareResponse} from '../sharing/resultShareAdapter';
import {nativeResultShare} from '../sharing/nativeResultShare';

export function ResultShareButton({record,previousBest,comparison,roundId,runtime,isCurrent,disabled=false,adapter=nativeResultShare}:{
  record:RoundRecord;previousBest?:RoundRecord;comparison?:RecentComparison|null;roundId:string;
  runtime:PlayRuntime;isCurrent:()=>boolean;disabled?:boolean;adapter?:ResultShareAdapter;
}) {
  const [busy,setBusy]=useState(false),[note,setNote]=useState('');
  const mounted=useRef(true),pending=useRef(false),current=useRef(isCurrent);current.current=isCurrent;
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  const result=buildShareResult({record,previousBest,comparison});
  if(!result)return null;
  const share=async()=>{
    if(disabled||pending.current||adapter.busy||!current.current())return;
    pending.current=true;setBusy(true);setNote('');
    const data={roundId,difficulty:record.level,result_type:record.cleared?'clear':'knockout',survived:record.survived,perfect:record.perfect,is_personal_best:result.isPersonalBest,has_recent_comparison:comparison!=null};
    runtime.track('share_tap',data);
    let response:ShareResponse|null;
    try{response=await adapter.share(result,()=>mounted.current&&current.current());}
    catch{response={outcome:'failed',hasLink:false};}
    if(response)runtime.track('share_outcome',{...data,outcome:response.outcome,has_link:response.hasLink});
    pending.current=false;
    if(mounted.current){
      setBusy(false);
      if(response?.outcome==='failed')setNote('공유창을 열지 못했어요. 다시 시도해 주세요.');
      else if(response?.outcome==='unsupported')setNote('이 환경에서는 공유를 지원하지 않아요.');
    }
  };
  return <View>
    <Pressable accessibilityRole="button" accessibilityLabel={RESULT_SHARE_LABEL} disabled={disabled||busy} onPress={()=>void share()} style={[styles.button,(disabled||busy)&&styles.disabled]}>
      <Text style={styles.label}>{busy?'공유 준비 중…':RESULT_SHARE_LABEL}</Text>
    </Pressable>
    {note?<Text accessibilityLiveRegion="polite" style={styles.note}>{note}</Text>:null}
  </View>;
}
const styles=StyleSheet.create({button:{minHeight:44,justifyContent:'center',alignItems:'center',borderRadius:10,backgroundColor:'#243B4D'},label:{color:'#CAD8D8',fontSize:14,fontWeight:'600'},disabled:{opacity:.55},note:{color:'#CAD8D8',fontSize:12,lineHeight:18}});
