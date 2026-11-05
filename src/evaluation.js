// Post-signal evaluation ONLY. Never call this inside detect().
export const HORIZONS=Object.freeze([15,30,60]);
export function evaluate(bars,signals){
 const events=[];
 for(let i=0;i<signals.length;i++){
  if(!signals[i].event)continue;
  const entry=bars[i],horizons={};
  for(const minutes of HORIZONS){
   const end=entry.t+minutes*60000;
   const future=[];
   for(let j=i+1;j<bars.length&&bars[j].t<end;j++)future.push(bars[j]);
   // Require the complete time horizon, and a continuous sequence of 1m bars.
   const complete=bars[i+minutes]!==undefined&&bars[i+minutes].t===end;
   if(!complete||future.length!==minutes-1){
    horizons[minutes]={complete:false,maxGainPct:null,maxDrawdownPct:null,timeToHighMin:null,hit5:false,hit10:false,hit20:false};continue;
   }
   // Include entry minute only from next candle onward. Avoid using entry-bar high before alert.
   const window=bars.slice(i+1,i+minutes+1);
   let high=-Infinity,low=Infinity,highAt=null;
   for(const b of window){if(b.h>high){high=b.h;highAt=b.t;}low=Math.min(low,b.l);}
   const maxGainPct=100*(high/entry.c-1),maxDrawdownPct=100*(low/entry.c-1);
   horizons[minutes]={complete:true,maxGainPct,maxDrawdownPct,timeToHighMin:(highAt-entry.t)/60000,
    hit5:maxGainPct>=5,hit10:maxGainPct>=10,hit20:maxGainPct>=20};
  }
  events.push({index:i,time:new Date(entry.t).toISOString(),price:entry.c,distancePct:signals[i].dist,score:signals[i].score,horizons});
 }
 const aggregate={};
 for(const min of HORIZONS){
  const valid=events.map(e=>e.horizons[min]).filter(x=>x.complete);
  aggregate[min]={n:valid.length,hit5:valid.filter(x=>x.hit5).length,hit10:valid.filter(x=>x.hit10).length,hit20:valid.filter(x=>x.hit20).length};
 }
 return {symbol:"BTRUSDT",total:events.length,events,aggregate};
}
