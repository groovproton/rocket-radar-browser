// Shared, deterministic, browser + Node. Each decision uses bars[0..i] only.
// Times are UTC; SMA(50) is calculated exclusively from CLOSED 15m bars.
export const CONFIG=Object.freeze({near:1,detach:1.4,velocity:0.6,gain:0.8,window:3,reset:0.6});
export function detect(bars,config=CONFIG){
 const out=[],completed=[];let sum=0,bucket=null,last=null,armed=false,active=false,trigger=-1;
 for(let i=0;i<bars.length;i++){
  const b=bars[i],nextBucket=Math.floor(b.t/900000);
  if(bucket!==null&&nextBucket!==bucket){
   // Never use the present partial 15m candle as the MA input.
   completed.push(last);sum+=last;
   if(completed.length>50)sum-=completed.shift();
  }
  bucket=nextBucket;last=b.c;
  const ma=completed.length===50?sum/50:null;
  const dist=ma===null?null:100*(b.c/ma-1);
  const prev=out[i-config.window];
  const velocity=dist!==null&&prev?.dist!==null?dist-prev.dist:0;
  const gain=i>=config.window?100*(b.c/bars[i-config.window].c-1):0;
  if(dist!==null&&Math.abs(dist)<config.near)armed=true;
  const event=Boolean(ma!==null&&armed&&!active&&dist>config.detach&&velocity>config.velocity&&gain>config.gain);
  if(event){active=true;armed=false;trigger=i;}
  if(active&&dist<config.reset)active=false;
  const recent=bars.slice(Math.max(0,i-20),i),avgV=recent.length?recent.reduce((a,x)=>a+x.v,0)/recent.length:0;
  const volRatio=avgV?b.v/avgV:1;
  const phase=ma===null?"WARMUP":event?"IGNITION":active?(i-trigger<=12&&velocity>0.2?"ACCELERATION":Math.abs(gain)<0.3?"SHELF":"FLIGHT"):dist>7?"LATE / WAIT":"BASE";
  const score=ma===null?0:Math.round(Math.max(0,Math.min(100,25+dist*2+velocity*12+Math.max(0,gain)*7+Math.min(3,volRatio)*5)));
  out.push({ma,dist,velocity,gain,volRatio,score,phase,event});
 }
 return out;
}
export function summarize(bars,signals){
 const events=[];
 for(let i=0;i<signals.length;i++)if(signals[i].event){
  const s=signals[i];events.push({time:new Date(bars[i].t).toISOString(),index:i,price:bars[i].c,ma:s.ma,distancePct:s.dist,score:s.score});
 }
 return {symbol:"BTRUSDT",candles:bars.length,firstTime:bars.length?new Date(bars[0].t).toISOString():null,lastTime:bars.length?new Date(bars.at(-1).t).toISOString():null,events};
}
