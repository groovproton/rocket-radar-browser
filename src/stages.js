// Two separate timestamped stages. This is an offline, causal state machine.
// V1 candidate detector stays unchanged; V2 confirmation may arrive later.
import {assessAt,V2_CONFIG} from "./confirmation.js";
export function stageEvents(bars,signals,config=V2_CONFIG){
 if(bars.length!==signals.length)throw Error("Bars/signals mismatch");
 const episodes=[],events=[];let pending=null;
 for(let i=0;i<bars.length;i++){
  const bar=bars[i];
  // Expire pending candidate before processing the next minute.
  if(pending&&bar.t>pending.deadline){
   pending.status="EXPIRED";pending=null;
  }
  if(signals[i].event){
   if(pending)pending.status="SUPERSEDED";
   const item={candidateIndex:i,candidateTime:new Date(bar.t).toISOString(),candidatePrice:bar.c,
     confirmationIndex:null,confirmationTime:null,confirmationPrice:null,delayMinutes:null,status:"CANDIDATE",
     scoreAtCandidate:null,scoreAtConfirmation:null,deadline:bar.t+config.confirmMinutes*60000};
   episodes.push(item);events.push({type:"CANDIDATE",index:i,time:item.candidateTime,price:bar.c});
   pending=item;
  }
  if(!pending)continue;
  // Only the current or subsequent completed 1m candle can confirm.
  const assessment=assessAt(bars,signals,i,config);
  if(i===pending.candidateIndex)pending.scoreAtCandidate=assessment.score;
  if(i>pending.candidateIndex&&assessment.confirmed){
   pending.status="CONFIRMED";pending.confirmationIndex=i;
   pending.confirmationTime=new Date(bar.t).toISOString();pending.confirmationPrice=bar.c;
   pending.delayMinutes=(bar.t-bars[pending.candidateIndex].t)/60000;
   pending.scoreAtConfirmation=assessment.score;
   events.push({type:"CONFIRMED",index:i,time:pending.confirmationTime,price:bar.c,candidateIndex:pending.candidateIndex,
     delayMinutes:pending.delayMinutes,score:assessment.score});
   pending=null;
  }
 }
 return {episodes,events};
}
