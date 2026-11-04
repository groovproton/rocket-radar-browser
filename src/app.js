import {unzip,loadCandles,detect} from "./engine.js";
import {evaluate} from "./evaluation.js";
import {confirm,compareV2} from "./confirmation.js";
import {stageEvents} from "./stages.js";
const symbols=["BTRUSDT"];
const $=id=>document.getElementById(id);
let bars=[],signals=[],evaluation=null,v2=null,comparison=null,stages=null,cursor=0,playing=false,timer=null,source="";
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
    signals=detect(bars);evaluation=evaluate(bars,signals);v2=confirm(bars,signals);comparison=compareV2(v2,evaluation);stages=stageEvents(bars,signals);
    cursor=Math.min(Math.max(0,50*15),bars.length-1);
    $("seek").max=bars.length-1;$("seek").min=0;$("seek").disabled=false;
    $("play").disabled=false;$("reset").disabled=false;
    $("reference").src="./data/"+symbol+"/chart.png";
    status(symbol+" · "+bars.length+" свечей · "+source);
    render();renderEvaluation();
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
  $("distance").textContent=pct(s.dist);$("phase").textContent=stages.events.findLast(e=>e.index===cursor)?.type??s.phase;$("score").textContent=s.ma?String(s.score):"—";
  $("seek").value=cursor;
  const start=Math.max(0,cursor-240);
  const visible=bars.slice(start,cursor+1);
  const analysis=signals.slice(start,cursor+1);
  draw($("chart"),visible.map(b=>b.c),analysis.map(s=>s.ma),analysis.flatMap((s,i)=>s.event?[i]:[]));
  draw($("volume"),visible.map(b=>b.v),[],[],true);
  const events=stages.events.filter(e=>e.index<=cursor).slice().reverse();
  $("events").innerHTML=events.length?'<table><thead><tr><th>UTC</th><th>Событие</th><th>Цена</th><th>Задержка</th></tr></thead><tbody>'+
    events.slice(0,60).map(e=>'<tr><td>'+date(Date.parse(e.time)).slice(5)+'</td><td class="'+(e.type==="CONFIRMED"?"green":"amber")+'">'+e.type+'</td><td>'+fmt(e.price)+'</td><td>'+(e.delayMinutes??"—")+'</td></tr>').join("")+'</tbody></table>':"<p>Пока событий нет.</p>";
  $("details").textContent="Свеча "+(cursor+1)+"/"+bars.length+" · ΔMA за 3 свечи: "+pct(s.velocity)+" · изменение цены за 3m: "+pct(s.gain)+" · объём/средний: "+s.volRatio.toFixed(2)+"× · первых сигналов: "+events.length+" · источник: "+source;
}

function jumpTo(index){
 stop();cursor=Math.min(index+60,bars.length-1);render();
 $("chart").scrollIntoView({behavior:"smooth",block:"center"});
}
function renderEvaluation(){
 const el=$("evaluation");if(!el||!evaluation)return;
 const percent=x=>x===null?"N/A":pct(x);
 const metric=(h,field)=>h.complete?percent(h[field]):"N/A";
 const rows=evaluation.events.map((e,k)=> {
   const h15=e.horizons[15],h30=e.horizons[30],h60=e.horizons[60];
   const check=v2[e.index];
   const stage=byCandidate.get(e.index);
   return '<tr><td><button type="button" data-ignition="'+e.index+'">'+date(Date.parse(e.time)).slice(5)+'</button></td>'+
     '<td>'+fmt(e.price)+'</td><td>'+pct(e.distancePct)+'</td>'+
     '<td class="'+(stage.status==="CONFIRMED"?"green":"amber")+'">'+stage.status+'</td>'+
     '<td>'+(stage.confirmationTime?date(Date.parse(stage.confirmationTime)).slice(5):"—")+'</td>'+
     '<td>'+(stage.confirmationPrice==null?"—":fmt(stage.confirmationPrice))+'</td>'+
     '<td>'+(stage.delayMinutes==null?"—":stage.delayMinutes+"m")+'</td>'+
     '<td class="'+(check.confirmed?"green":"amber")+'">'+check.status+'</td>'+
     '<td>'+check.score+'/7</td><td>'+(check.volumeRatio==null?"N/A":check.volumeRatio.toFixed(1)+"×")+'</td>'+
     '<td>'+(check.breakout60?"✓":"—")+'</td><td>'+(check.breakout240?"✓":"—")+'</td>'+
     '<td>'+(check.persistence?"✓":"—")+'</td><td>'+(check.accel?"✓":"—")+'</td>'+
     '<td>'+metric(h15,"maxGainPct")+'</td><td>'+metric(h30,"maxGainPct")+'</td><td>'+metric(h60,"maxGainPct")+'</td>'+
     '<td>'+metric(h60,"maxDrawdownPct")+'</td><td>'+(h60.complete?h60.timeToHighMin+"m":"N/A")+'</td>'+
     '<td>'+(h60.complete?["+5","+10","+20"].filter((_,i)=>[h60.hit5,h60.hit10,h60.hit20][i]).join(", ")||"—":"N/A")+'</td></tr>';
 }).join("");
 const a=evaluation.aggregate;
 const confirmedCount=stages.episodes.filter(e=>e.status==="CONFIRMED").length;
 el.innerHTML='<p>Все '+evaluation.total+' сигналов BTR. Здесь показан результат ПОСЛЕ сигнала; детектор не использует эти данные.</p>'+
 '<p>Попадания за 60 минут (+5 / +10 / +20%): '+a[60].hit5+' / '+a[60].hit10+' / '+a[60].hit20+
 ' из '+a[60].n+' завершённых окон.</p>'+
 '<p><strong>Два этапа:</strong> '+confirmedCount+' подтверждений после CANDIDATE (окно 10 минут). Момент подтверждения отличается от времени кандидата.</p>'+ 
 '<p><strong>V2 на минуте кандидата (диагностика):</strong> '+comparison.confirmed' подтверждений из '+comparison.total+' кандидатов; +5% за час среди подтверждённых: '+comparison.confirmedHits5+'; отклонённых успешных: '+comparison.unconfirmedHits5+'. Порог score ≥ 4/7 (экспериментальный).</p>'+ 
 '<div style="overflow:auto"><table><thead><tr><th>IGNITION UTC</th><th>Цена</th><th>ΔMA</th><th>Этап 2</th><th>Время подтверждения</th><th>Цена подтверждения</th><th>Задержка</th><th>V2 в момент кандидата</th><th>Score</th><th>Объём 5m</th><th>High 1h</th><th>High 4h</th><th>3 свечи ↑</th><th>Ускор.</th><th>High 15m</th><th>High 30m</th><th>High 60m</th><th>Low 60m</th><th>До high</th><th>Пороги</th></tr></thead><tbody>'+rows+'</tbody></table></div>';
 el.querySelectorAll("[data-ignition]").forEach(button=>button.addEventListener("click",()=>jumpTo(Number(button.dataset.ignition))));
}
