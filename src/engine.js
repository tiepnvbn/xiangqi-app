// Fast Xiangqi engine: make/unmake, iterative-deepening alpha-beta (PVS), transposition table, quiescence,
// killer/history ordering, check extension, repetition + perpetual-check scoring.
// Piece codes: red K1 A2 B3 N4 R5 C6 P7, black = +8. Squares 0..89, row 0 = Black's back rank.
const CODE={K:1,A:2,B:3,N:4,R:5,C:6,P:7},toCode=ch=>ch?CODE[ch.toUpperCase()]+(ch>='a'?8:0):0;
const VAL=[0,0,200,200,450,1000,500,100],MATE=30000,WIN=20000,MAXPLY=96,INF=32000;
const O=[[1,0],[-1,0],[0,1],[0,-1]],D=[[1,1],[1,-1],[-1,1],[-1,-1]],ok=(r,c)=>r>=0&&r<10&&c>=0&&c<9,pal=(r,c)=>c>=3&&c<=5&&(r<=2||r>=7);
const KM=[],AM=[],BM=[],NM=[],RAY=[],PM=[[],[]],NATK=Array.from({length:90},()=>[]),PATK=[Array.from({length:90},()=>[]),Array.from({length:90},()=>[])];
for(let sq=0;sq<90;sq++){const r=(sq/9)|0,c=sq%9;KM[sq]=[];AM[sq]=[];BM[sq]=[];NM[sq]=[];RAY[sq]=[[],[],[],[]];PM[0][sq]=[];PM[1][sq]=[];
  if(pal(r,c)){for(const[a,d]of O){const R=r+a,C=c+d;if(ok(R,C)&&pal(R,C)&&(R<=2)===(r<=2))KM[sq].push(R*9+C)}
    for(const[a,d]of D){const R=r+a,C=c+d;if(ok(R,C)&&pal(R,C)&&(R<=2)===(r<=2))AM[sq].push(R*9+C)}}
  for(const[a,d]of D){const R=r+2*a,C=c+2*d;if(ok(R,C)&&(R<=4)===(r<=4))BM[sq].push([R*9+C,(r+a)*9+c+d])}
  for(const[a,d]of O){const R=r+a,C=c+d;if(!ok(R,C))continue;
    for(const[TR,TC]of a?[[r+2*a,c-1],[r+2*a,c+1]]:[[r-1,c+2*d],[r+1,c+2*d]])if(ok(TR,TC)){NM[sq].push([TR*9+TC,R*9+C]);NATK[TR*9+TC].push([sq,R*9+C])}}
  O.forEach(([a,d],i)=>{let R=r+a,C=c+d;while(ok(R,C)){RAY[sq][i].push(R*9+C);R+=a;C+=d}});
  if(r>0)PM[0][sq].push(sq-9);if(r<=4){if(c>0)PM[0][sq].push(sq-1);if(c<8)PM[0][sq].push(sq+1)}
  if(r<9)PM[1][sq].push(sq+9);if(r>=5){if(c>0)PM[1][sq].push(sq-1);if(c<8)PM[1][sq].push(sq+1)}}
for(let s=0;s<2;s++)for(let p=0;p<90;p++)for(const t of PM[s][p])PATK[s][t].push(p);
let seed=0x9e3779b9;const rnd=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return seed|0};
const ZL=new Int32Array(1440),ZH=new Int32Array(1440);for(let i=0;i<1440;i++){ZL[i]=rnd();ZH[i]=rnd()}const SL=rnd(),SH=rnd();
const B=new Int8Array(90),ksq=[-1,-1],CAPS=new Int8Array(MAXPLY+4);let side=0,hL=0,hH=0;
const HL=new Int32Array(1500),HH=new Int32Array(1500),CHK=new Uint8Array(1500),CAPIDX=new Int32Array(1500);let hp=0;
const TS_=1<<19,TM_=TS_-1,TK=new Int32Array(TS_),TH=new Int32Array(TS_),TSC=new Int32Array(TS_),TMV=new Int32Array(TS_),TD=new Int8Array(TS_),TF=new Int8Array(TS_);
const MV=Array.from({length:MAXPLY+4},()=>new Int32Array(160)),SC=Array.from({length:MAXPLY+4},()=>new Int32Array(160));
const KIL=[new Int32Array(MAXPLY+4),new Int32Array(MAXPLY+4)],HIST=new Int32Array(2*8100);
let nodes=0,deadline=0,stop=false;

function setup(chars,turn){B.fill(0);ksq[0]=ksq[1]=-1;for(let i=0;i<90;i++){B[i]=toCode(chars[i]);if((B[i]&7)===1)ksq[B[i]>>3]=i}side=turn==='b'?1:0;hL=hH=0;
  for(let i=0;i<90;i++)if(B[i]){hL^=ZL[B[i]*90+i];hH^=ZH[B[i]*90+i]}if(side){hL^=SL;hH^=SH}}
function make(m,ply){const f=m&127,t=m>>7,p=B[f],c=B[t];CAPS[ply]=c;B[t]=p;B[f]=0;
  hL^=ZL[p*90+f]^ZL[p*90+t]^SL;hH^=ZH[p*90+f]^ZH[p*90+t]^SH;if(c){hL^=ZL[c*90+t];hH^=ZH[c*90+t]}if((p&7)===1)ksq[p>>3]=t;side^=1}
function unmake(m,ply){const f=m&127,t=m>>7,p=B[t],c=CAPS[ply];B[f]=p;B[t]=c;
  hL^=ZL[p*90+f]^ZL[p*90+t]^SL;hH^=ZH[p*90+f]^ZH[p*90+t]^SH;if(c){hL^=ZL[c*90+t];hH^=ZH[c*90+t]}if((p&7)===1)ksq[p>>3]=f;side^=1}
function attacked(sq,by){const r0=by<<3,rays=RAY[sq];
  for(let d=0;d<4;d++){const ray=rays[d],n=ray.length;let i=0;
    for(;i<n;i++){const p=B[ray[i]];if(p){if(p===r0+5)return true;break}}
    for(i++;i<n;i++){const p=B[ray[i]];if(p){if(p===r0+6)return true;break}}}
  for(const[k,l]of NATK[sq])if(B[k]===r0+4&&!B[l])return true;
  for(const p of PATK[by][sq])if(B[p]===r0+7)return true;return false}
function facing(){const a=ksq[0],b=ksq[1];if(a<0||b<0||a%9!==b%9)return false;const hi=Math.max(a,b);for(let s=Math.min(a,b)+9;s<hi;s+=9)if(B[s])return false;return true}
const inCheck=sd=>attacked(ksq[sd],sd^1)||facing();

function gen(ply,sd,caps){const L=MV[ply];let n=0;
  for(let f=0;f<90;f++){const p=B[f];if(!p||(p>>3)!==sd)continue;const t=p&7;
    if(t===1||t===2||t===7){const T=t===1?KM[f]:t===2?AM[f]:PM[sd][f];for(let i=0;i<T.length;i++){const to=T[i],q=B[to];if(q?(q>>3)!==sd:!caps)L[n++]=f|(to<<7)}}
    else if(t===3){const T=BM[f];for(let i=0;i<T.length;i++){const to=T[i][0],q=B[to];if(!B[T[i][1]]&&(q?(q>>3)!==sd:!caps))L[n++]=f|(to<<7)}}
    else if(t===4){const T=NM[f];for(let i=0;i<T.length;i++){const to=T[i][0],q=B[to];if(!B[T[i][1]]&&(q?(q>>3)!==sd:!caps))L[n++]=f|(to<<7)}}
    else if(t===5){for(let d=0;d<4;d++){const ray=RAY[f][d];for(let i=0;i<ray.length;i++){const to=ray[i],q=B[to];if(!q){if(!caps)L[n++]=f|(to<<7);continue}if((q>>3)!==sd)L[n++]=f|(to<<7);break}}}
    else{for(let d=0;d<4;d++){const ray=RAY[f][d];let scr=false;for(let i=0;i<ray.length;i++){const to=ray[i],q=B[to];
      if(!scr){if(!q){if(!caps)L[n++]=f|(to<<7)}else scr=true}else if(q){if((q>>3)!==sd)L[n++]=f|(to<<7);break}}}}}
  return n}
function order(ply,n,sd,ttm){const L=MV[ply],S=SC[ply];
  for(let i=0;i<n;i++){const m=L[i],f=m&127,t=m>>7,v=B[t];
    S[i]=m===ttm?2e6:v?1e5+VAL[v&7]*10-(B[f]&7):m===KIL[0][ply]?9e4:m===KIL[1][ply]?8e4:HIST[sd*8100+f*90+t]}}
function pick(ply,i,n){const L=MV[ply],S=SC[ply];let b=i;for(let j=i+1;j<n;j++)if(S[j]>S[b])b=j;
  if(b!==i){const m=L[i];L[i]=L[b];L[b]=m;const s=S[i];S[i]=S[b];S[b]=s}return L[i]}
function evaluate(){let s=0;
  for(let i=0;i<90;i++){const p=B[i];if(!p)continue;const sd=p>>3,t=p&7,r=(i/9)|0,c=i%9,rank=sd?r:9-r,d=c>4?c-4:4-c;let v=VAL[t];
    if(t===7)v+=rank>=5?100+(rank-5)*8+(4-d)*10:rank*4;
    else if(t===4)v+=(4-d)*5+Math.min(rank,7)*4;else if(t===5)v+=Math.min(rank,8)*3;
    else if(t===6)v+=(4-d)*4+(rank>=3&&rank<=6?6:0);
    if(t>=4){const ek=ksq[sd^1];if(ek>=0){const dist=Math.abs(r-((ek/9)|0))+Math.abs(c-ek%9);v+=Math.max(0,14-dist)*(t===5?2:t===7?1:3)}}   // pressure on the enemy general
    s+=sd?-v:v}
  return(side?-s:s)+10}
function rep(){const lim=CAPIDX[hp];
  for(let j=hp-2;j>=lim&&j>=0;j-=2)if(HL[j]===hL&&HH[j]===hH){let oAll=true,sAll=true;
    for(let k=j+1;k<=hp;k++){if(((hp-k)&1)===0){if(!CHK[k])oAll=false}else if(!CHK[k])sAll=false}
    if(oAll&&!sAll)return WIN;if(sAll&&!oAll)return-WIN;return 0}
  return null}
function pushH(ply){hp++;HL[hp]=hL;HH[hp]=hH;CHK[hp]=inCheck(side)?1:0;CAPIDX[hp]=CAPS[ply]?hp:CAPIDX[hp-1]}
function qsearch(alpha,beta,ply){nodes++;const stand=evaluate();if(stand>=beta||ply>=MAXPLY-2)return stand;if(stand>alpha)alpha=stand;
  const sd=side,n=gen(ply,sd,true);order(ply,n,sd,0);
  for(let i=0;i<n;i++){const m=pick(ply,i,n),v=B[m>>7];if(stand+VAL[v&7]+150<alpha)continue;
    make(m,ply);if(inCheck(sd)){unmake(m,ply);continue}const s=-qsearch(-beta,-alpha,ply+1);unmake(m,ply);
    if(s>=beta)return s;if(s>alpha)alpha=s}
  return alpha}
function search(depth,alpha,beta,ply){
  if(stop)return 0;if((++nodes&1023)===0&&Date.now()>deadline){stop=true;return 0}
  if(ply>0){const r=rep();if(r!==null)return r}
  const sd=side,inChk=inCheck(sd);if(inChk)depth++;
  if(depth<=0)return qsearch(alpha,beta,ply);if(ply>=MAXPLY-2)return evaluate();
  const idx=hL&TM_;let ttm=0;
  if(TK[idx]===hL&&TH[idx]===hH){ttm=TMV[idx];if(TD[idx]>=depth&&ply>0){let s=TSC[idx];if(s>25000)s-=ply;else if(s<-25000)s+=ply;const f=TF[idx];
    if(f===0||(f===1&&s>=beta)||(f===2&&s<=alpha))return s}}
  const a0=alpha,n=gen(ply,sd,false);order(ply,n,sd,ttm);let best=-INF,bm=0,legal=0;
  for(let i=0;i<n;i++){const m=pick(ply,i,n);make(m,ply);if(inCheck(sd)){unmake(m,ply);continue}
    legal++;pushH(ply);const quiet=!CAPS[ply];let sc;
    if(legal===1)sc=-search(depth-1,-beta,-alpha,ply+1);
    else{const red=depth>=3&&legal>4&&!inChk&&quiet&&!CHK[hp]?1:0;sc=-search(depth-1-red,-alpha-1,-alpha,ply+1);if(sc>alpha&&(red||sc<beta))sc=-search(depth-1,-beta,-alpha,ply+1)}
    hp--;unmake(m,ply);if(stop)return 0;
    if(sc>best){best=sc;bm=m;if(sc>alpha){alpha=sc;if(alpha>=beta){if(quiet){if(KIL[0][ply]!==m){KIL[1][ply]=KIL[0][ply];KIL[0][ply]=m}HIST[sd*8100+(m&127)*90+(m>>7)]+=depth*depth}break}}}}
  if(!legal)return-MATE+ply;
  let st=best;if(st>25000)st+=ply;else if(st<-25000)st-=ply;
  if(TD[idx]<=depth||TK[idx]!==hL){TK[idx]=hL;TH[idx]=hH;TSC[idx]=st;TMV[idx]=bm;TD[idx]=depth;TF[idx]=best<=a0?2:best>=beta?1:0}
  return best}

const LEVELS=[{depth:1,noise:150},{depth:2,noise:50},{depth:5,ms:500},{depth:8,ms:1500},{depth:12,ms:4000},{depth:20,ms:10000}];
export const LEVEL_NAMES=['Beginner','Easy','Medium','Hard','Expert (~4s)','Master (~10s)'];
function loadTimeline(timeline,b,turn){
  let tl=timeline&&timeline.length?timeline.slice(-1000):[{b,turn}],prev=null;hp=-1;
  for(const st of tl){setup(st.b,st.turn);hp++;HL[hp]=hL;HH[hp]=hH;CHK[hp]=hp>0&&inCheck(side)?1:0;
    let cnt=0;for(let i=0;i<90;i++)if(B[i])cnt++;CAPIDX[hp]=hp>0&&prev!==null&&cnt<prev?hp:hp>0?CAPIDX[hp-1]:0;prev=cnt}
  setup(b,turn)}
export function legalMoves(chars,turn){setup(chars,turn);const out=[],n=gen(0,side,false),L=MV[0].slice(0,n),sd=side;
  for(const m of L){make(m,0);if(!inCheck(sd))out.push([m&127,m>>7]);unmake(m,0)}return out}
export function perft(chars,turn,depth){setup(chars,turn);const go=(d,ply)=>{if(d===0)return 1;const sd=side,n=gen(ply,sd,false),L=MV[ply].slice(0,n);let t=0;
  for(const m of L){make(m,ply);if(!inCheck(sd))t+=go(d-1,ply+1);unmake(m,ply)}return t};return go(depth,0)}
// req: {b: array of 90 chars, turn:'w'|'b', timeline:[{b,turn}...] (positions so far, last = current), level}
export function think(req){
  const cfg=LEVELS[Math.max(0,Math.min(LEVELS.length-1,req.level|0))];loadTimeline(req.timeline,req.b,req.turn);
  TK.fill(0);HIST.fill(0);for(const k of KIL)k.fill(0);nodes=0;stop=false;const t0=Date.now(),sd=side;
  let roots=[];{const n=gen(0,sd,false),L=MV[0].slice(0,n);for(const m of L){make(m,0);if(!inCheck(sd))roots.push(m);unmake(m,0)}}
  if(!roots.length)return null;
  for(let i=roots.length-1;i>0;i--){const j=(Math.random()*(i+1))|0;[roots[i],roots[j]]=[roots[j],roots[i]]}
  if(roots.length===1)return{move:[roots[0]&127,roots[0]>>7],depth:0,nodes:0,ms:0};
  if(cfg.noise){deadline=Infinity;let bm=roots[0],bs=-INF;
    for(const m of roots){make(m,0);pushH(0);const s=-search(cfg.depth-1,-INF,INF,1)+Math.random()*cfg.noise;hp--;unmake(m,0);if(s>bs){bs=s;bm=m}}
    return{move:[bm&127,bm>>7],depth:cfg.depth,nodes,ms:Date.now()-t0}}
  deadline=t0+cfg.ms;let best=roots[0],bestScore=0,done=0;
  for(let d=1;d<=cfg.depth;d++){let alpha=-INF,ib=roots[0],is=-INF;
    for(let i=0;i<roots.length;i++){const m=roots[i];make(m,0);pushH(0);let sc;
      if(i===0)sc=-search(d-1,-INF,-alpha,1);else{sc=-search(d-1,-alpha-1,-alpha,1);if(sc>alpha&&!stop)sc=-search(d-1,-INF,-alpha,1)}
      hp--;unmake(m,0);if(stop)break;if(sc>is){is=sc;ib=m;if(sc>alpha)alpha=sc}}
    if(stop)break;best=ib;bestScore=is;done=d;roots.splice(roots.indexOf(ib),1);roots.unshift(ib);
    if(Math.abs(is)>MATE-200||Date.now()-t0>cfg.ms*0.55)break}
  return{move:[best&127,best>>7],depth:done,score:bestScore,nodes,ms:Date.now()-t0}}
