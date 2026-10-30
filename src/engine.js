// No live market requests. ZIP reading uses Chromium's built-in DecompressionStream.
const decoder = new TextDecoder();
const u16 = (v,p) => v.getUint16(p,true);
const u32 = (v,p) => v.getUint32(p,true);
export async function unzip(buffer) {
  const view = new DataView(buffer), bytes = new Uint8Array(buffer);
  let eocd=-1;
  for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--) {
    if(u32(view,i)===0x06054b50){eocd=i;break;}
  }
  if(eocd<0)throw Error("ZIP: не найден central directory");
  const count=u16(view,eocd+10),offset=u32(view,eocd+16);
  let p=offset; const result=[];
  for(let i=0;i<count;i++){
    if(u32(view,p)!==0x02014b50)throw Error("ZIP: некорректная запись");
    const method=u16(view,p+10), size=u32(view,p+20),len=u16(view,p+28);
    const extra=u16(view,p+30),comment=u16(view,p+32),local=u32(view,p+42);
    const name=decoder.decode(bytes.subarray(p+46,p+46+len));
    p+=46+len+extra+comment;
    if(name.endsWith("/")||size>80_000_000)continue;
    if(u32(view,local)!==0x04034b50)throw Error("ZIP: некорректный local header");
    const start=local+30+u16(view,local+26)+u16(view,local+28);
    let content=bytes.slice(start,start+size);
    if(method===8){
      const stream=new Blob([content]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
      content=new Uint8Array(await new Response(stream).arrayBuffer());
    }else if(method!==0)continue;
    result.push({name,content});
  }
  return result;
}
function csvRows(str){
  const lines=str.replace(/^\uFEFF/,"").split(/\r?\n/).filter(x=>x.trim());
  if(!lines.length)return [];
  const sep=lines[0].includes("\t")?"\t":",";
  const data=lines.map(l=>l.split(sep).map(s=>s.trim().replace(/^"|"$/g,"")));
  const head=data[0].map(s=>s.toLowerCase().replace(/[\s_-]/g,""));
  const column=(...names)=>head.findIndex(h=>names.includes(h));
  let t=column("opentime","timestamp","time","date","datetime","starttime","t");
  let o=column("open","o"),h=column("high","h"),l=column("low","l"),c=column("close","c"),v=column("volume","vol","basevolume","v");
  const headed=t>=0&&o>=0&&h>=0&&l>=0&&c>=0;
  if(!headed){t=0;o=1;h=2;l=3;c=4;v=5;}
  return data.slice(headed?1:0).map(row=>{
    let timestamp=Number(row[t]);
    if(!Number.isFinite(timestamp)){
      timestamp=Date.parse(row[t]);
    }else if(timestamp<1e11)timestamp*=1000;
    const bar={t:timestamp,o:Number(row[o]),h:Number(row[h]),l:Number(row[l]),c:Number(row[c]),v:Number(row[v]||0)};
    return bar;
  }).filter(x=>Number.isFinite(x.t)&&x.t>1e11&&x.o>0&&x.h>0&&x.l>0&&x.c>0);
}
function fromJSON(str){
  const root=JSON.parse(str);
  const rows=Array.isArray(root)?root:(root.data||root.klines||root.candles||[]);
  return rows.map(x=>{
    if(Array.isArray(x))return {t:Number(x[0])<1e11?Number(x[0])*1000:Number(x[0]),o:+x[1],h:+x[2],l:+x[3],c:+x[4],v:+x[5]||0};
    const time=Number(x.openTime??x.open_time??x.timestamp??x.time??x.t);
    return {t:time<1e11?time*1000:time,o:+(x.open??x.o),h:+(x.high??x.h),l:+(x.low??x.l),c:+(x.close??x.c),v:+(x.volume??x.v)||0};
  }).filter(x=>Number.isFinite(x.t)&&x.t>1e11&&x.c>0);
}
export function loadCandles(files){
  const candidates=[];
  for(const file of files){
    if(!/\.(csv|json)$/i.test(file.name))continue;
    if(/(trade|aggtrade|funding|open.interest|order.book|depth|liquidation)/i.test(file.name))continue;
    try{
      const rows=file.name.toLowerCase().endsWith(".json")?fromJSON(decoder.decode(file.content)):csvRows(decoder.decode(file.content));
      if(rows.length<100)continue;
      rows.sort((a,b)=>a.t-b.t);
      const diffs=rows.slice(1,Math.min(rows.length,300)).map((b,i)=>b.t-rows[i].t).filter(x=>x>0);
      const interval=diffs.sort((a,b)=>a-b)[Math.floor(diffs.length/2)]||Infinity;
      const nameRank=/1m\b|1min|_1m|\/1m/i.test(file.name)?3:/kline|candle|ohlcv/i.test(file.name)?2:0;
      candidates.push({file:file.name,rows,interval,rank:nameRank});
    }catch(e){console.warn("Не удалось прочесть",file.name,e);}
  }
  candidates.sort((a,b)=>a.interval-b.interval||b.rank-a.rank||b.rows.length-a.rows.length);
  if(!candidates.length)throw Error("В ZIP не найден CSV/JSON с OHLCV. Нужны 1m свечи.");
  const chosen=candidates[0];
  if(chosen.interval>60000)throw Error("В ZIP нет 1m OHLCV (минимальный интервал "+Math.round(chosen.interval/60000)+" минут).");
  const unique=new Map(chosen.rows.map(x=>[x.t,x]));
  return {rows:[...unique.values()].sort((a,b)=>a.t-b.t),source:chosen.file};
}
// Only 15m candles that have actually closed contribute to MA.
export function detect(bars){
  const result=[];const closes=[];let bucket=null,lastClose=null,rolling=0;
  let flight=false,lastTrigger=-1,wasNear=false;
  for(let i=0;i<bars.length;i++){
    const b=bars[i],bkt=Math.floor(b.t/900000);
    if(bucket!==null&&bkt!==bucket&&lastClose!==null){
      closes.push(lastClose);rolling+=lastClose;
      if(closes.length>50)rolling-=closes.shift();
    }
    bucket=bkt;lastClose=b.c;
    const ma=closes.length===50?rolling/50:null;
    const dist=ma===null?null:100*(b.c/ma-1);
    const prev=result[Math.max(0,i-3)];
    const velocity=dist!==null&&prev?.dist!==null?dist-prev.dist:0;
    const gain=i>=3?100*(b.c/bars[i-3].c-1):0;
    const recent=bars.slice(Math.max(0,i-20),i);
    const avgV=recent.length?recent.reduce((a,x)=>a+x.v,0)/recent.length:0;
    const volRatio=avgV?b.v/avgV:1;
    if(dist!==null&&Math.abs(dist)<1.0)wasNear=true;
    // Early acceleration; volume improves score but does not delay ignition.
    const ignition=ma!==null&&wasNear&&dist>1.4&&velocity>0.6&&gain>0.8&&!flight;
    if(ignition){flight=true;lastTrigger=i;wasNear=false;}
    if(flight&&(dist===null||dist<0.6||(i-lastTrigger>180&&velocity<=0)))flight=false;
    let phase="BASE";
    if(ma===null)phase="WARMUP";
    else if(ignition)phase="IGNITION";
    else if(flight){
      if(i-lastTrigger<=12&&velocity>0.2)phase="ACCELERATION";
      else if(i-lastTrigger>12&&Math.abs(gain)<0.3)phase="SHELF";
      else phase="FLIGHT";
    }else if(dist>7)phase="LATE / WAIT";
    // Explicitly heuristic, NOT a calibrated probability.
    const score=ma===null?0:Math.round(Math.min(100,Math.max(0,25+dist*2+velocity*12+Math.max(0,gain)*7+Math.min(3,volRatio)*5)));
    result.push({ma,dist,velocity,gain,volRatio,score,phase,event:ignition});
  }
  return result;
}
