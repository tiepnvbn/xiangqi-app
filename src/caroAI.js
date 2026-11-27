// Caro / gomoku AI: every 5-cell window is scored by how many stones one side has in it (windows holding both colours are dead).
// The score is updated incrementally, then alpha-beta search (iterative deepening, move ordering, forced-block detection) picks the move.
import {winAt} from './caro.js';
export const CARO_LEVELS=[
  {name:'Beginner',depth:1,K:6,ms:100,sloppy:true},
  {name:'Easy',depth:1,K:8,ms:100},
  {name:'Medium',depth:3,K:10,ms:1000,agg:1.25},
  {name:'Hard',depth:6,K:9,ms:2500,agg:1.25},
  {name:'Expert (~5s)',depth:14,K:8,ms:5000,agg:1.25}];
const T=[0,1,10,130,1800,1e6],WIN=9e5,BIG=1e9;
const tables={};
function tableFor(N){if(tables[N])return tables[N];const wins=[],cw=Array.from({length:N*N},()=>[]);
  for(const[dr,dc]of[[0,1],[1,0],[1,1],[1,-1]])for(let r=0;r<N;r++)for(let c=0;c<N;c++){const er=r+4*dr,ec=c+4*dc;if(er<0||er>=N||ec<0||ec>=N)continue;
    const id=wins.length,cells=[];for(let k=0;k<5;k++){const q=(r+k*dr)*N+c+k*dc;cells.push(q);cw[q].push(id)}wins.push(cells)}
  return tables[N]={wins,cw}}

class Search{
  constructor(b,N,rule,mul){this.N=N;this.rule=rule;this.mul=mul||[0,1,1];const t=tableFor(N);this.W=t.wins.length;this.cw=t.cw;this.b=Int8Array.from(b);
    this.c1=new Int8Array(this.W);this.c2=new Int8Array(this.W);this.near=new Int16Array(N*N);this.S=0;this.nodes=0;this.stop=false;this.deadline=Infinity;
    for(let i=0;i<N*N;i++)if(b[i])this.place(i,b[i],true)}
  val(w){const a=this.c1[w],o=this.c2[w];return a&&o?0:a?T[a]*this.mul[1]:o?-T[o]*this.mul[2]:0}
  place(i,p,init){const cw=this.cw[i],c=p===1?this.c1:this.c2;for(let k=0;k<cw.length;k++){const w=cw[k],old=this.val(w);c[w]++;this.S+=this.val(w)-old}
    this.b[i]=p;this.bump(i,1)}
  unplace(i,p){const cw=this.cw[i],c=p===1?this.c1:this.c2;for(let k=0;k<cw.length;k++){const w=cw[k],old=this.val(w);c[w]--;this.S+=this.val(w)-old}
    this.b[i]=0;this.bump(i,-1)}
  bump(i,d){const N=this.N,r=(i/N)|0,c=i%N;for(let R=Math.max(0,r-2);R<=Math.min(N-1,r+2);R++)for(let C=Math.max(0,c-2);C<=Math.min(N-1,c+2);C++)this.near[R*N+C]+=d}
  gain(i,p){const s=this.S;this.place(i,p);const g=(this.S-s)*(p===1?1:-1);this.unplace(i,p);return g}
  exactWin(i,p){this.b[i]=p;const w=winAt(this.b,this.N,i,this.rule);this.b[i]=0;return!!w}
  cands(p){const n=this.N*this.N,o=[];for(let i=0;i<n;i++)if(!this.b[i]&&this.near[i]>0)o.push({i,g:this.gain(i,p),og:this.gain(i,3-p)});return o}
  // returns {win:cell|-1, forced:[cells], list}
  analyse(p){const list=this.cands(p);let win=-1;
    for(const c of list)if(c.g>=WIN&&(this.rule!=='vn'||this.exactWin(c.i,p))){win=c.i;break}
    let forced=null;if(win<0){const f=list.filter(c=>c.og>=WIN&&(this.rule!=='vn'||this.exactWin(c.i,3-p)));if(f.length)forced=f}
    return{win,forced,list}}
  order(list,K){list.sort((a,b)=>(b.g+b.og*.9)-(a.g+a.og*.9));return list.length>K?list.slice(0,K):list}
  search(d,alpha,beta,p,ply,K){
    if((++this.nodes&1023)===0&&Date.now()>this.deadline)this.stop=true;if(this.stop)return 0;
    const a=this.analyse(p);if(a.win>=0)return BIG-ply;if(!a.list.length)return 0;
    if(d<=0)return(p===1?1:-1)*this.S;
    let list=a.forced?a.forced:this.order(a.list,K);
    if(a.forced&&a.forced.length>1)return-(BIG-ply-1);                  // two different winning cells for the opponent: lost
    let best=-Infinity;
    for(const c of list){this.place(c.i,p);const v=-this.search(d-1,-beta,-alpha,3-p,ply+1,K);this.unplace(c.i,p);if(this.stop)return 0;
      if(v>best)best=v;if(v>alpha)alpha=v;if(alpha>=beta)break}
    return best}
}
export function thinkCaro(req){
  const t0=Date.now(),N=req.N,cfg=CARO_LEVELS[Math.max(0,Math.min(CARO_LEVELS.length-1,req.level|0))],rng=req.rng||Math.random,p=req.player,rule=req.rule||'free';
  const b=req.board,stones=b.reduce((a,x)=>a+(x?1:0),0);
  if(stones===0){const c=(N>>1)*N+(N>>1);return{move:c,depth:0,ms:0}}
  const mul=[0,1,1];mul[p]=cfg.agg||1;const s=new Search(b,N,rule,mul),a=s.analyse(p);
  if(a.win>=0)return{move:a.win,depth:0,ms:Date.now()-t0};
  if(!a.list.length)return null;
  if(a.forced&&!(cfg.sloppy&&rng()<.3))return{move:a.forced[0].i,depth:0,ms:Date.now()-t0};
  const base=s.order(a.list.slice(),cfg.K);
  if(cfg.depth<=1){const pool=cfg.sloppy?base.slice(0,4):base.slice(0,1);const c=pool[(rng()*pool.length)|0];return{move:c.i,depth:1,ms:Date.now()-t0}}
  s.deadline=t0+cfg.ms;let best=base[0].i,done=1,order=base.map(c=>c.i);
  for(let d=2;d<=cfg.depth;d++){s.stop=false;let alpha=-Infinity,cur=-1,curV=-Infinity,full=true;
    for(const i of order){s.place(i,p);const v=-s.search(d-1,-BIG*2,-alpha,3-p,1,cfg.K);s.unplace(i,p);if(s.stop){full=false;break}
      if(v>curV){curV=v;cur=i}if(v>alpha)alpha=v}
    if(!full)break;best=cur;done=d;order=[cur,...order.filter(x=>x!==cur)];if(curV>=BIG-50)break}
  return{move:best,depth:done,ms:Date.now()-t0}}
