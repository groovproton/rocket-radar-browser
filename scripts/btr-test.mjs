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
 const lines=text.replace(/^\uFEFF/,"").trim().split(/\r?\n/);
 let start=0;
 if(!/^\d{10,13}[,\t]/.test(lines[0]))start=1;
 return lines.slice(start).map(line=>{
  const r=line.split(",");
  let t=Number(r[0]);if(t<1e11)t*=1000;
  return {t,o:+r[1],h:+r[2],l:+r[3],c:+r[4],v:+r[5]||0};
 }).filter(r=>Number.isFinite(r.t)&&r.t>1e11&&r.c>0).sort((a,b)=>a.t-b.t);
}
function validate(bars,signals){
 if(bars.length<751)throw Error("Too few BTR candles for MA50 15m");
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
