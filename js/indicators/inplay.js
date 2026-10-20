import {median} from '../market/candles.js';
export class InplayDetector{
 constructor({windowMs=60000,minBaseline=20,rvolThreshold=5,minQuote=10000}={}){Object.assign(this,{windowMs,minBaseline,rvolThreshold,minQuote});this.events=[];this.baseline=null;}
 setBaseline(closedMinutes){const a=closedMinutes.slice(-1440).map(c=>c.quote).filter(x=>Number.isFinite(x)&&x>=0);this.baseline=a.length>=this.minBaseline?median(a):null;}
 add(event){if(!Number.isFinite(event.quote)||!Number.isFinite(event.time))return;this.events.push(event);this.prune(event.time);}
 prune(now){while(this.events.length&&this.events[0].time<=now-this.windowMs)this.events.shift();}
 snapshot(now){this.prune(now);const quote=this.events.reduce((s,e)=>s+e.quote,0);const count=this.events.length;const rvol=this.baseline>0?quote/this.baseline:null;return {quote,count,rvol,ready:rvol!==null,active:rvol!==null&&rvol>=this.rvolThreshold&&quote>=this.minQuote};}
}
