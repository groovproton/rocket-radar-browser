import {aggregate} from '../market/candles.js';
export function detachment15(closedOneMinute,{maPeriod=50,thresholdPct=4}={}){
 const minuteSet=new Set(closedOneMinute.filter(c=>c.closed).map(c=>c.t));
 const bars=aggregate(closedOneMinute,900000).filter(b=>Array.from({length:15},(_,i)=>b.t+i*60000).every(t=>minuteSet.has(t)));
 // A 15m candle is complete only when the final 1m member exists and is closed.
 if(bars.length<maPeriod+1)return {ready:false,reason:'insufficient 15m history',bars:bars.length};
 const last=bars.slice(-maPeriod),prev=bars.slice(-maPeriod-1,-1);const avg=a=>a.reduce((s,b)=>s+b.close,0)/a.length;
 const ma=avg(last),pma=avg(prev),price=last.at(-1).close,previous=prev.at(-1).close;
 if(ma<=0||pma<=0)return {ready:false,reason:'invalid MA'};
 const d=(price/ma-1)*100,pd=(previous/pma-1)*100,delta=d-pd;
 return {ready:true,price,ma,detachmentPct:d,deltaPct:delta,strong:Math.abs(d)>=thresholdPct,state:Math.abs(d)<thresholdPct?'NORMAL':Math.sign(d)*delta>0?'EXPANDING':'DETACHED_OR_COOLING',t:last.at(-1).t};
}
