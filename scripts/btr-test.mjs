#!/usr/bin/env node
// Run: node scripts/btr-test.mjs [--json] [--assert]
import {readFileSync} from "node:fs";
import {inflateRawSync} from "node:zlib";
import {detect,summarize} from "../src/signal.js";
import {evaluate} from "../src/evaluation.js";
import {confirm,compareV2,V2_CONFIG} from "../src/confirmation.js";
import {stageEvents} from "../src/stages.js";
import {eventsBetween,alertText} from "../src/alerts.js";
const path="data/BTRUSDT/market.zip";
function unzip(bytes){
 const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 const u16=p=>v.getUint16(p,true),u32=p=>v.getUint32(p,true);
 let end=-1;
 for(let p=bytes.length-22;p>=Math.max(0,bytes.length-65557);p--)if(u32(p)===0x06054b50){end=p;break;}
 if(end<0)throw Error("Invalid ZIP");
 const files=[];let p=u32(end+16);
 for(let k=0;k<u16(end+10);k++){
  if(u32(p)!==0x02014b50)throw Error("Invalid ZIP directory");
  const method=u16(p+10),size=u32(p+20),nameLen=u16(p+28),extra=u16(p+30),comment=u16(p+32),local=u32(p+42);
  const name=bytes.subarray(p+46,p+46+nameLen).toString();
  p+=46+nameLen+extra+comment;
  if(!/futures_klines_1m\.csv$/i.test(name))continue;
  const start=local+30+u16(local+26)+u16(local+28);
  const payload=bytes.subarray(start,start+size);
  files.push({name,text:(method===8?inflateRawSync(payload):payload).toString()});
 }
 return files;
}
function csv(text){
 const lines=text.replace(/^\uFEFF/,"").split(/\r?\n/).filter(line=>line.trim());
 if(!lines.length)throw Error("Empty CSV");
 const delim=lines[0].includes("\t")?"\t":",";
 const data=lines.map(line=>line.split(delim).map(value=>value.trim().replace(/^"|"$/g,"")));
 const headers=data[0].map(value=>value.toLowerCase().replace(/[\s_-]/g,""));
 const col=(...names)=>headers.findIndex(header=>names.includes(header));
 let t=col("opentime","timestamp","time","date","datetime","starttime","t");
 let o=col("open","o"),h=col("high","h"),l=col("low","l"),c=col("close","c"),v=col("volume","vol","basevolume","v");
 const headed=t>=0&&o>=0&&h>=0&&l>=0&&c>=0;
 if(!headed){t=0;o=1;h=2;l=3;c=4;v=5;}
 const bars=data.slice(headed?1:0).map(row=>{
   const raw=row[t],n=Number(raw);
   const timestamp=raw!==""&&Number.isFinite(n)?(n<1e11?n*1000:n):Date.parse(raw);
   return {t:timestamp,o:Number(row[o]),h:Number(row[h]),l:Number(row[l]),c:Number(row[c]),v:Number(row[v]||0)};
 }).filter(b=>Number.isFinite(b.t)&&b.t>1e11&&b.o>0&&b.h>0&&b.l>0&&b.c>0);
 bars.sort((a,b)=>a.t-b.t);
 const unique=[...new Map(bars.map(b=>[b.t,b])).values()];
 if(unique.length<751)throw Error("Parsed "+unique.length+"/"+data.length+" candles. CSV first rows: "+lines.slice(0,2).map(x=>x.slice(0,200)).join(" | "));
 return unique;
}
function validate(bars,signals){
 if(bars.length<751)throw Error("Too few BTR candles for MA50 15m: "+bars.length);
 if(signals.length!==bars.length)throw Error("One signal per candle required");
 if(signals.some(s=>s.event&&!Number.isFinite(s.ma)))throw Error("Signal without MA");
 // Causality: full replay and prefix must have identical signal decisions.
 for(const size of [751,1000,Math.floor(bars.length/2),bars.length-1]){
  const prefix=detect(bars.slice(0,size));
  for(let i=0;i<size;i++){
   if(prefix[i].event!==signals[i].event||prefix[i].phase!==signals[i].phase)throw Error("LOOKAHEAD at "+i);
  }
 }
 // Sanity test that fully closed 15m is used.
 const test=Array.from({length:766},(_,i)=>({t:i*60000,c:1,o:1,h:1,l:1,v:1}));
 const det=detect(test);
 if(det[750].ma!==1)throw Error("Completed 15m SMA unavailable");
 const changed=test.map(b=>({...b}));changed[750].c=100;
 if(detect(changed)[750].ma!==1)throw Error("Current incomplete 15m candle leaked into SMA");
 return {causality:"PASS",closedCandleMA:"PASS",rows:"PASS"};
}
const flags=process.argv.slice(2);
try{
 const found=unzip(readFileSync(path));if(found.length!==1)throw Error("Expected one futures_klines_1m.csv in BTR ZIP; found "+found.length);
 const bars=csv(found[0].text);
 const signals=detect(bars),checks=validate(bars,signals),evaluation=evaluate(bars,signals);
 if(evaluation.events.length!==signals.filter(s=>s.event).length)throw Error("Evaluation event mismatch");
 for(const event of evaluation.events){for(const minutes of [15,30,60]){const m=event.horizons[minutes];if(m.complete&&(!Number.isFinite(m.maxGainPct)||!Number.isFinite(m.maxDrawdownPct)||m.timeToHighMin<1||m.timeToHighMin>minutes))throw Error("Invalid forward metrics");}}
 const v2=confirm(bars,signals),comparison=compareV2(v2,evaluation);
 // Regression: the original V1 event count and known BTR timestamp must remain unchanged.
 const btrTime="2026-10-22T17:16:00.000Z";
 if(evaluation.total!==14||!evaluation.events.some(e=>e.time===btrTime))throw Error("V1 reference regression: expected 14 candidates including BTR 17:16");
 // Causal V2: computing with a prefix cannot change past confirmation decisions.
 for(const size of [751,1000,Math.floor(bars.length/2),bars.length-1]){
  const prior=confirm(bars.slice(0,size),signals.slice(0,size));
  for(let i=0;i<size;i++){
   if(prior[i]?.score!==v2[i]?.score||prior[i]?.confirmed!==v2[i]?.confirmed)throw Error("V2 LOOKAHEAD at "+i);
  }
 }
 // A post-signal outcome is allowed for evaluation only, never for confirmation.
 const selected=v2.find(x=>x?.time===btrTime);
 if(!selected)throw Error("BTR V2 event missing");

 const stages=stageEvents(bars,signals);
 if(stages.episodes.length!==14)throw Error("Stage candidate count regression");
 for(const e of stages.episodes){
  if(e.status==="CONFIRMED"&&!(e.confirmationIndex>e.candidateIndex&&e.delayMinutes>0&&e.delayMinutes<=V2_CONFIG.confirmMinutes))throw Error("Invalid confirmation timeline");
 }
 for(const size of [751,1000,Math.floor(bars.length/2),bars.length-1]){
  const prefix=stageEvents(bars.slice(0,size),signals.slice(0,size));
  const fullVisible=stages.events.filter(e=>e.index<size);
  if(JSON.stringify(prefix.events)!==JSON.stringify(fullVisible))throw Error("Stage lookahead: event history differs at "+size);
 }
 // Replay alert contract: only events crossed in forward playback; no seek or duplicate.
 const allAlerts=stages.events;
 const chunks=eventsBetween(allAlerts,-1,Math.floor(bars.length/2)).concat(
   eventsBetween(allAlerts,Math.floor(bars.length/2),bars.length-1));
 if(JSON.stringify(chunks)!==JSON.stringify(allAlerts))throw Error("Replay alert event coverage failed");
 if(eventsBetween(allAlerts,100,100).length||eventsBetween(allAlerts,200,100).length)throw Error("Seek must not emit alerts");
 if(allAlerts.some(e=>!["CANDIDATE","CONFIRMED","EXPIRED"].includes(e.type)||!alertText(e).body))throw Error("Invalid alert");
 const report={...summarize(bars,signals),evaluation,v2:{config:V2_CONFIG,...comparison},
   stages,source:found[0].name,checks:{...checks,evaluation:"PASS",v2Causality:"PASS",v1Regression:"PASS",stageOrder:"PASS",stageCausality:"PASS",replayAlerts:"PASS"}};
 if(flags.includes("--json"))console.log(JSON.stringify(report,null,2));
 else{
  console.log("BTRUSDT offline | "+bars.length+" 1m candles | "+report.events.length+" ignition events");
  console.log("First:",report.firstTime,"Last:",report.lastTime);
  for(const e of evaluation.events){const fmt=m=>{const x=e.horizons[m];return x.complete?`+${x.maxGainPct.toFixed(2)}% / ${x.maxDrawdownPct.toFixed(2)}% / ${x.timeToHighMin}m`:"N/A";};console.log(e.time,"price",e.price,"ΔMA",e.distancePct.toFixed(2)+"%","15m",fmt(15),"30m",fmt(30),"60m",fmt(60));}
  console.log("Hits (+5/+10/+20):",JSON.stringify(evaluation.aggregate));
  console.log("V2: confirmed",comparison.confirmed,"of",comparison.total,"| confirmed +5% hits",comparison.confirmedHits5,
    "| missed +5% among candidates",comparison.unconfirmedHits5);
  for(const e of comparison.results){
   console.log("V2",e.time,e.status,"score",e.score,"vol5/baseline",e.volumeRatio?.toFixed(2)??"N/A",
     "breakout60",e.breakout60,"breakout240",e.breakout240,"persist",e.persistence,"accel",e.accel,
     "high60",e.outcome60?.complete?e.outcome60.maxGainPct.toFixed(2)+"%":"N/A");
  }
  console.log("TWO STAGES: candidates",stages.episodes.length,
    "confirmed",stages.episodes.filter(e=>e.status==="CONFIRMED").length,
    "expired",stages.episodes.filter(e=>e.status==="EXPIRED").length);
  for(const e of stages.episodes)console.log("STAGES",e.candidateTime,e.candidatePrice,"->",
    e.confirmationTime??e.status,e.confirmationPrice??"",e.delayMinutes==null?"":e.delayMinutes+"m");
  console.log("TEST:",Object.entries(report.checks).map(([k,v])=>k+"="+v).join(" "));
 }
}catch(e){console.error("FAIL:",e.message);process.exitCode=1;}
