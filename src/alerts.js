// Pure replay alert selection and formatting, also used by CLI assertions.
export function eventsBetween(events,fromIndex,toIndex){
 if(!Number.isInteger(fromIndex)||!Number.isInteger(toIndex)||toIndex<=fromIndex)return [];
 return events.filter(e=>e.index>fromIndex&&e.index<=toIndex);
}
export function alertText(event){
 const when=new Date(event.time).toISOString().replace("T"," ").slice(0,16)+" UTC";
 const price=Number(event.price).toFixed(5);
 const title=event.type==="CONFIRMED"?"🚀 BTRUSDT — CONFIRMED":event.type==="EXPIRED"?"⌛ BTRUSDT — EXPIRED":"📡 BTRUSDT — CANDIDATE";
 const detail=event.type==="CONFIRMED"?"После кандидата: "+event.delayMinutes+" мин · Score "+event.score+"/7":event.type==="EXPIRED"?"Кандидат не подтвердился в течение 10 минут":"Ранний сигнал отрыва от MA50 15m";
 return {title,body:when+" · Цена "+price+"\n"+detail};
}
