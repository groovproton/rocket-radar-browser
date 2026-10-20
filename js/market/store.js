export class CandleStore{
 constructor(limit=1600){this.limit=limit;this.closed=new Map();this.lastTradeId=null;this.gapSuspected=false;}
 bootstrap(rows){this.closed=new Map(rows.filter(x=>x.closed).map(c=>[c.t,c]));this.trim();}
 ingest(c){if(!c.closed)return;const previous=[...this.closed.keys()].at(-1);if(previous!=null&&c.t>previous+60000)this.gapSuspected=true;this.closed.set(c.t,c);this.closed=new Map([...this.closed].sort((a,b)=>a[0]-b[0]));this.trim();}
 trim(){while(this.closed.size>this.limit)this.closed.delete(this.closed.keys().next().value);}
 list(){return [...this.closed.values()];}
}
