#!/usr/bin/env node
// Run: node scripts/btr-test.mjs [--json] [--assert]
import {readFileSync} from "node:fs";
import {inflateRawSync} from "node:zlib";
import {detect,summarize} from "../src/signal.js";
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
 const signals=detect(bars),checks=validate(bars,signals),report={...summarize(bars,signals),source:found[0].name,checks};
 if(flags.includes("--json"))console.log(JSON.stringify(report,null,2));
 else{
  console.log("BTRUSDT offline | "+bars.length+" 1m candles | "+report.events.length+" ignition events");
  console.log("First:",report.firstTime,"Last:",report.lastTime);
  for(const e of report.events)console.log(e.time,"price",e.price,"ΔMA",e.distancePct.toFixed(2)+"%","score",e.score);
  console.log("TEST:",Object.entries(checks).map(([k,v])=>k+"="+v).join(" "));
 }
}catch(e){console.error("FAIL:",e.message);process.exitCode=1;}
