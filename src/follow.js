// Diagnostic post-confirmation tracking. No effect on detection or confirmation.
// All values at index i use only bars/signals through i; historical replay stays causal.
export const FOLLOW_CONFIG=Object.freeze({window:5,maxMinutes:60,stableMinutes:3,cooldownMinutes:5});
export function followConfirmed(bars,signals,stages,config=FOLLOW_CONFIG){
 if(bars.length!==signals.length)throw Error("Bars/signals length mismatch");
 const points=Array(bars.length).fill(null),events=[];
 const confirmed=stages.episodes.filter(e=>e.confirmationIndex!==null)
   .sort((a,b)=>a.confirmationIndex-b.confirmationIndex);
 let active=null,at=0,previousLabel=null,streak=0,lastEvent=-Infinity;
 for(let i=0;i<bars.length;i++){
  while(at<confirmed.length&&confirmed[at].confirmationIndex===i){
   active=confirmed[at++];previousLabel=null;streak=0;lastEvent=-Infinity;
  }
  if(!active)continue;
  const start=active.confirmationIndex,elapsed=(bars[i].t-bars[start].t)/60000;
  if(elapsed>config.maxMinutes){active=null;continue;}
  const from=Math.max(start,i-config.window);
  const recent=bars.slice(from,i+1);
  const continuous=recent.every((b,k)=>k===0||b.t-recent[k-1].t===60000);
  const path=recent.reduce((sum,b,k)=>k===0?sum:sum+Math.abs(b.c-recent[k-1].c),0);
  const net=bars[i].c-bars[from].c;
  const efficiency=continuous&&i>from&&path>0?net/path:null; // -1..1; flat => null
  const segment=bars.slice(start,i+1);
  const peak=Math.max(...segment.map(b=>b.c));
  const base=bars[start].c;
  const peakGain=100*(peak/base-1);
  const netGain=100*(bars[i].c/base-1);
  const retention=peakGain>0?Math.max(0,Math.min(1,netGain/peakGain)):null;
  const prior=signals[i-3]?.dist;
  const maSpeed=Number.isFinite(signals[i].dist)&&Number.isFinite(prior)
    ?signals[i].dist-prior:null; // percentage points / 3 minutes
  let label="OBSERVING";
  if(elapsed>=config.window&&efficiency!==null&&retention!==null&&maSpeed!==null){
   if(efficiency>=0.65&&retention>=0.8&&maSpeed>0.15)label="FLIGHT";
   else if(retention<0.5||efficiency<=-0.4&&maSpeed<0)label="WEAKENING";
   else if(Math.abs(efficiency)<0.4&&Math.abs(maSpeed)<0.4)label="SHELF";
  }
  points[i]={index:i,candidateIndex:active.candidateIndex,confirmationIndex:start,
    elapsed,efficiency,retention,maSpeed,peakGain,netGain,label};
  if(label===previousLabel)streak++;else{previousLabel=label;streak=1;}
  if(label!=="OBSERVING"&&streak>=config.stableMinutes&&i-lastEvent>=config.cooldownMinutes&&
     (events.length===0||events.at(-1).confirmationIndex!==start||events.at(-1).label!==label)){
   events.push({type:"FOLLOW",label,index:i,time:new Date(bars[i].t).toISOString(),price:bars[i].c,
     confirmationIndex:start,efficiency,retention,maSpeed,elapsed});
   lastEvent=i;
  }
 }
 return {points,events};
}
