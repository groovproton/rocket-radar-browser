// Rocket Radar V2: causal confirmation of V1 candidates (1m OHLCV only).
// No future data, no optimising against post-signal price movement.
// V1 detect() remains the source of candidate events.
export const V2_CONFIG=Object.freeze({
  minScore:4, baselineMinutes:60, shortMinutes:5, breakoutMinutes:60, majorMinutes:240
});
export function confirm(bars,signals,config=V2_CONFIG){
 if(bars.length!==signals.length)throw Error("Bars/signals length mismatch");
 return signals.map((signal,i)=>{
  if(!signal.event)return null;
  const b=bars[i],history=bars.slice(Math.max(0,i-config.majorMinutes),i);
  // Require the complete prior hour; missing history cannot validate a breakout.
  const prior60=bars.slice(Math.max(0,i-config.breakoutMinutes),i);
  const baseline=bars.slice(Math.max(0,i-config.baselineMinutes),i-config.shortMinutes);
  const recent=bars.slice(Math.max(0,i-config.shortMinutes+1),i+1);
  const contiguous=arr=>arr.every((x,j)=>j===0||x.t-arr[j-1].t===60000);
  const ready=prior60.length===config.breakoutMinutes&&baseline.length===config.baselineMinutes-config.shortMinutes&&
    recent.length===config.shortMinutes&&contiguous(prior60)&&contiguous(baseline)&&contiguous(recent)&&
    recent.at(-1).t===b.t&&prior60.at(-1).t===b.t-60000;
  const meanV=baseline.reduce((sum,x)=>sum+x.v,0)/Math.max(1,baseline.length);
  const currentV=recent.reduce((sum,x)=>sum+x.v,0)/Math.max(1,recent.length);
  const volumeRatio=ready&&meanV>0?currentV/meanV:null;
  // Compare close to highs BEFORE the current 1m candle.
  const breakout60=ready&&b.c>Math.max(...prior60.map(x=>x.h));
  const breakout240=ready&&history.length===config.majorMinutes&&contiguous(history)&&b.c>Math.max(...history.map(x=>x.h));
  // Persistence: three most recent close-to-close returns positive.
  const persistence=ready&&i>=3&&bars[i].c>bars[i-1].c&&bars[i-1].c>bars[i-2].c&&bars[i-2].c>bars[i-3].c;
  // Require 3m detachment acceleration stronger than the preceding 10m average.
  const previous=signals[i-10]?.dist;
  const accel=ready&&Number.isFinite(previous)&&signal.velocity>0&&
    signal.dist-previous>0&&signal.velocity>0.3*(signal.dist-previous);
  const volumeStrong=volumeRatio!==null&&volumeRatio>=3;
  const volumeModerate=volumeRatio!==null&&volumeRatio>=1.7;
  const score=(breakout60?1:0)+(breakout240?2:0)+(volumeStrong?2:volumeModerate?1:0)+(persistence?1:0)+(accel?1:0);
  const confirmed=ready&&score>=config.minScore;
  return {index:i,time:new Date(b.t).toISOString(),price:b.c,ready,confirmed,
    status:!ready?"INSUFFICIENT_DATA":confirmed?"ROCKET START":"CANDIDATE",
    score,volumeRatio,breakout60,breakout240,persistence,accel};
 });
}
export function compareV2(v2,evaluation){
 const byIndex=new Map(evaluation.events.map(e=>[e.index,e]));
 const results=v2.filter(Boolean).map(v=>{
   const old=byIndex.get(v.index);
   return {...v,outcome60:old?.horizons[60]??null};
 });
 const eligible=results.filter(v=>v.outcome60?.complete);
 const isHit=v=>v.outcome60.maxGainPct>=5;
 const confirmed=eligible.filter(v=>v.confirmed);
 const candidates=eligible.filter(v=>!v.confirmed);
 return {total:results.length,confirmed:results.filter(v=>v.confirmed).length,
   eligible:eligible.length,confirmedWithComplete60m:confirmed.length,
   confirmedHits5:confirmed.filter(isHit).length,unconfirmedHits5:candidates.filter(isHit).length,
   results};
}
