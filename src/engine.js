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
export {detect, summarize, CONFIG} from './signal.js';
