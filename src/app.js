import {unzip,loadCandles,detect} from "./engine.js";
const symbols=["BTRUSDT"];
const $=id=>document.getElementById(id);
let bars=[],signals=[],cursor=0,playing=false,timer=null,source="";
$("symbol").innerHTML=symbols.map(s=>'<option>'+s+'</option>').join("");
$("symbol").value="BTRUSDT";
const status=(s,err=false)=>{$("status").textContent=s;$("status").className=err?"error":""};
const fmt=x=>x==null?"—":Number(x).toFixed(x<0.01?7:x<1?5:3);
const pct=x=>x==null?"—":(x>=0?"+":"")+x.toFixed(2)+"%";
const date=t=>new Date(t).toISOString().replace("T"," ").slice(0,16);
$("load").onclick=async()=>{
  stop();$("play").disabled=true;status("Читаю архив...");
  try{
    const symbol=$("symbol").value;
    const response=await fetch("./data/"+symbol+"/market.zip");
    if(!response.ok)throw Error("HTTP "+response.status+" при загрузке market.zip");
    const files=await unzip(await response.arrayBuffer());
    const loaded=loadCandles(files);bars=loaded.rows;source=loaded.source;
    signals=detect(bars);
    cursor=Math.min(Math.max(0,50*15),bars.length-1);
    $("seek").max=bars.length-1;$("seek").min=0;$("seek").disabled=false;
    $("play").disabled=false;$("reset").disabled=false;
    $("reference").src="./data/"+symbol+"/chart.png";
    status(symbol+" · "+bars.length+" свечей · "+source);
    render();
  }catch(e){bars=[];signals=[];status("Ошибка: "+e.message,true);console.error(e);}
};
function stop(){playing=false;clearInterval(timer);timer=null;$("play").textContent="▶ Replay";}
function start(){
  if(!bars.length)return;
  playing=true;$("play").textContent="❚❚ Пауза";
  timer=setInterval(()=>{
    cursor=Math.min(bars.length-1,cursor+Number($("speed").value));
    render();
    if(cursor===bars.length-1)stop();
  },250);
}
$("play").onclick=()=>playing?stop():start();
$("reset").onclick=()=>{stop();cursor=Math.min(750,bars.length-1);render()};
$("seek").oninput=()=>{stop();cursor=Number($("seek").value);render()};
$("symbol").onchange=()=>{stop();bars=[];signals=[];$("play").disabled=true;$("reset").disabled=true;$("seek").disabled=true;status("Нажми «Загрузить ZIP»");};
function draw(canvas,values,maValues,events,volume=false){
  const ctx=canvas.getContext("2d"),w=canvas.width,h=canvas.height;
  ctx.clearRect(0,0,w,h);ctx.fillStyle="#101b2b";ctx.fillRect(0,0,w,h);
  if(!values.length)return;
  const all=volume?values:values.concat(maValues.filter(Number.isFinite));
  const min=volume?0:Math.min(...all), max=Math.max(...all);
  const low=volume?0:min-(max-min)*0.08,span=Math.max(1e-9,max-low+(volume?0:(max-min)*0.08));
  const x=i=>35+i*(w-50)/Math.max(1,values.length-1);
  const y=v=>h-18-(v-low)/span*(h-35);
  ctx.strokeStyle="#22334a";ctx.lineWidth=1;
  for(let i=0;i<5;i++){let yy=15+i*(h-33)/4;ctx.beginPath();ctx.moveTo(35,yy);ctx.lineTo(w-14,yy);ctx.stroke();}
  if(volume){ctx.fillStyle="#397d91";values.forEach((v,i)=>ctx.fillRect(x(i),y(v),Math.max(1,(w-50)/values.length*.75),h-18-y(v)));}
  else {
    for(const [arr,color] of [[values,"#37d7b2"],[maValues,"#50a7ff"]]){
      ctx.beginPath();ctx.strokeStyle=color;ctx.lineWidth=2;let connected=false;
      arr.forEach((v,i)=>{if(!Number.isFinite(v)){connected=false;return;} if(!connected){ctx.moveTo(x(i),y(v));connected=true;}else ctx.lineTo(x(i),y(v));});ctx.stroke();
    }
    events.forEach(i=>{ctx.fillStyle="#ffcd64";ctx.beginPath();ctx.arc(x(i),y(values[i]),5,0,Math.PI*2);ctx.fill();});
  }
}
function render(){
  if(!bars.length)return;
  cursor=Math.max(0,Math.min(cursor,bars.length-1));
  const b=bars[cursor],s=signals[cursor];
  $("clock").textContent=date(b.t);$("price").textContent=fmt(b.c);$("ma").textContent=fmt(s.ma);
  $("distance").textContent=pct(s.dist);$("phase").textContent=s.phase;$("score").textContent=s.ma?String(s.score):"—";
  $("seek").value=cursor;
  const start=Math.max(0,cursor-240);
  const visible=bars.slice(start,cursor+1);
  const analysis=signals.slice(start,cursor+1);
  draw($("chart"),visible.map(b=>b.c),analysis.map(s=>s.ma),analysis.flatMap((s,i)=>s.event?[i]:[]));
  draw($("volume"),visible.map(b=>b.v),[],[],true);
  const events=signals.slice(0,cursor+1).flatMap((s,i)=>s.event?[{i,s}]:[]).reverse();
  $("events").innerHTML=events.length?'<table><thead><tr><th>UTC</th><th>Цена</th><th>Отрыв</th><th>Score</th></tr></thead><tbody>'+events.slice(0,60).map(({i,s})=>'<tr><td>'+date(bars[i].t).slice(5)+'</td><td>'+fmt(bars[i].c)+'</td><td class="green">'+pct(s.dist)+'</td><td>'+s.score+'</td></tr>').join("")+'</tbody></table>':"<p>Пока сигналов нет.</p>";
  $("details").textContent="Свеча "+(cursor+1)+"/"+bars.length+" · ΔMA за 3 свечи: "+pct(s.velocity)+" · изменение цены за 3m: "+pct(s.gain)+" · объём/средний: "+s.volRatio.toFixed(2)+"× · первых сигналов: "+events.length+" · источник: "+source;
}
