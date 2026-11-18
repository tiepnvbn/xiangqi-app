// Local board detection (no ML model): find piece circles -> fit the 9x10 lattice -> crop tiles for naming.
const sobel=(c,W,H)=>{const gx=new Float32Array(W*H),gy=new Float32Array(W*H);
  for(let y=1;y<H-1;y++)for(let x=1;x<W-1;x++){const i=y*W+x,a=c[i-W-1],b=c[i-W],d=c[i-W+1],e=c[i-1],f=c[i+1],g=c[i+W-1],h=c[i+W],k=c[i+W+1];
    gx[i]=(d+2*f+k)-(a+2*e+g);gy[i]=(g+2*h+k)-(a+2*b+d)}return[gx,gy]};
const pct=(a,q)=>{const s=Float32Array.from(a);s.sort();return s[Math.floor(q*(s.length-1))]};
const med=a=>{const s=[...a].sort((x,y)=>x-y);return s[s.length>>1]};

function circles(G,W,H){
  const n=W*H,gx=new Float32Array(n),gy=new Float32Array(n),mag=new Float32Array(n);
  for(let i=0;i<n;i++){let bm=-1,bx=0,by=0;for(let c=0;c<3;c++){const x=G[c][0][i],y=G[c][1][i],m=Math.hypot(x,y);if(m>bm){bm=m;bx=x;by=y}}gx[i]=bx;gy[i]=by;mag[i]=bm}
  const thr=Math.max(pct(mag,0.80),25),E=[];for(let i=0;i<n;i++)if(mag[i]>thr)E.push(i);
  const rmin=Math.max(6,Math.floor(W*0.03)),rmax=Math.floor(W*0.075),best=new Float32Array(n),bR=new Uint8Array(n),v=new Float32Array(n);
  for(let r=rmin;r<=rmax;r++){v.fill(0);
    for(const i of E){const m=mag[i],ux=gx[i]/m,uy=gy[i]/m,x=i%W,y=(i/W)|0;
      for(const s of[1,-1]){const cx=Math.round(x+s*r*ux),cy=Math.round(y+s*r*uy);if(cx>=0&&cx<W&&cy>=0&&cy<H)v[cy*W+cx]++}}
    const k=2*Math.PI*r;
    for(let y=0;y<H;y++)for(let x=0;x<W;x++){let s=0;
      for(let dy=-1;dy<=1;dy++){const yy=y+dy;if(yy<0||yy>=H)continue;for(let dx=-1;dx<=1;dx++){const xx=x+dx;if(xx>=0&&xx<W)s+=v[yy*W+xx]}}
      s/=k;const i=y*W+x;if(s>best[i]){best[i]=s;bR[i]=r}}}
  const c=[];for(let i=0;i<n;i++)if(best[i]>0.30)c.push({s:best[i],x:i%W,y:(i/W)|0,r:bR[i]});
  c.sort((a,b)=>b.s-a.s);const out=[];
  for(const q of c.slice(0,4000)){if(out.every(o=>{const d=1.4*Math.max(q.r,o.r);return(q.x-o.x)**2+(q.y-o.y)**2>d*d}))out.push(q)}
  return out}

function pick(out){
  if(out.length<2)return[];let b=null;
  for(let i=1;i<out.length;i++){if(out[i-1].s<0.5)break;const ratio=out[i-1].s/Math.max(out[i].s,1e-3);if(!b||ratio>b.ratio)b={ratio,i}}
  if(!b||b.ratio<1.5)return[];
  const keep=out.slice(0,b.i),mr=med(keep.map(o=>o.r));return keep.filter(o=>Math.abs(o.r-mr)<=0.3*mr)}

function fitGrid(P,G,W,H){
  const X=P.map(o=>o.x),Y=P.map(o=>o.y),r=med(P.map(o=>o.r));let best=null;
  for(let p=1.8*r;p<3.2*r;p+=0.1){let a=0,b=0,c=0,d=0;
    for(let i=0;i<X.length;i++){const u=2*Math.PI*X[i]/p,w=2*Math.PI*Y[i]/p;a+=Math.cos(u);b+=Math.sin(u);c+=Math.cos(w);d+=Math.sin(w)}
    const s=Math.hypot(a,b)+Math.hypot(c,d);if(!best||s>best.s)best={s,p,ax:Math.atan2(b,a),ay:Math.atan2(d,c)}}
  const p=best.p,x0=best.ax*p/(2*Math.PI),y0=best.ay*p/(2*Math.PI),fit=best.s/(2*P.length);
  const kx=X.map(v=>Math.round((v-x0)/p)),ky=Y.map(v=>Math.round((v-y0)/p));
  const n=W*H,sx=new Float32Array(n),sy=new Float32Array(n);
  for(let i=0;i<n;i++){sx[i]=Math.abs(G[0][0][i])+Math.abs(G[1][0][i])+Math.abs(G[2][0][i]);sy[i]=Math.abs(G[0][1][i])+Math.abs(G[1][1][i])+Math.abs(G[2][1][i])}
  const tx=pct(sx,0.9),ty=pct(sy,0.9),colS=new Float32Array(W),rowS=new Float32Array(H);
  for(let y=0;y<H;y++)for(let x=0;x<W;x++){if(P.some(o=>(x-o.x)**2+(y-o.y)**2<(1.25*o.r)**2))continue;const i=y*W+x;if(sx[i]>tx)colS[x]++;if(sy[i]>ty)rowS[y]++}
  const at=(a,pos)=>{const i=Math.round(pos);let m=0;for(let j=Math.max(0,i-1);j<Math.min(a.length,i+2);j++)m=Math.max(m,a[j]);return m};
  const opts=(k,S,o0,cnt)=>{const L=[];for(let off=-Math.min(...k);off<=cnt-1-Math.max(...k);off++){
    let sc=0;for(let c=0;c<cnt;c++)sc+=at(S,o0+(c-off)*p);sc-=at(S,o0+(-1-off)*p)+at(S,o0+(cnt-off)*p);L.push({sc,off})}return L.sort((a,b)=>b.sc-a.sc)};
  return{p,r,fit,kx,ky,cols:opts(kx,colS,x0,9),rows:opts(ky,rowS,y0,10)}}

// rgba: downscaled image data. Returns null when local detection isn't trustworthy.
export function detectCore(rgba,W,H){
  const n=W*H,G=[0,1,2].map(c=>{const a=new Float32Array(n);for(let i=0;i<n;i++)a[i]=rgba[i*4+c];return sobel(a,W,H)});
  const P=pick(circles(G,W,H));if(P.length<2)return null;
  for(const q of P){const px=[];
    for(let y=Math.max(0,Math.floor(q.y-q.r));y<=Math.min(H-1,q.y+q.r);y++)for(let x=Math.max(0,Math.floor(q.x-q.r));x<=Math.min(W-1,q.x+q.r);x++){
      if((x-q.x)**2+(y-q.y)**2>(0.85*q.r)**2)continue;const i=(y*W+x)*4;px.push([rgba[i],rgba[i+1],rgba[i+2]])}
    q.lum=med(px.map(v=>(v[0]+v[1]+v[2])/3));q.fr=px.reduce((t,v)=>t+v[0]-(v[1]+v[2])/2,0)/px.length}
  // side by colour: the biggest gap in mean disc redness splits red pieces from black ones (if there is a clear gap)
  const fr=P.map(q=>q.fr).sort((a,b)=>a-b);let gi=0,gm=0;for(let i=1;i<fr.length;i++)if(fr[i]-fr[i-1]>gm){gm=fr[i]-fr[i-1];gi=i}
  const cut=gm>=12?(fr[gi]+fr[gi-1])/2:Infinity;P.forEach(q=>{q.rs=q.fr>cut?100:0});
  P.sort((a,b)=>a.y-b.y||a.x-b.x);
  const g=fitGrid(P,G,W,H);if(g.fit<0.8||!g.cols.length||!g.rows.length)return null;
  P.forEach((q,i)=>{q.kx=g.kx[i];q.ky=g.ky[i]});return{P,g,W,H,rgba}}

const T={'帥':['K',1],'帅':['K',1],'將':['K',0],'将':['K',0],'仕':['A',1],'士':['A',0],'相':['B',1],'象':['B',0],'傌':['N',1],'馬':['N'],'马':['N'],
  '俥':['R',1],'車':['R'],'车':['R'],'炮':['C'],'砲':['C'],'兵':['P',1],'卒':['P',0]};

// chars: one character per tile, in the same order as d.P. Returns {board,warn,ambiguous} or null.
export function finishCore(d,chars){
  const{P,g}=d;if(!Array.isArray(chars)||chars.length!==P.length)return null;
  const print=!P.some(p=>p.rs>35)&&P.some(p=>p.lum<90);
  const L=P.map((p,i)=>{const t=T[String(chars[i]||'').trim()[0]];if(!t)return null;
    const red=t[1]!==undefined?!!t[1]:p.rs>35?true:p.lum<90?false:print;return red?t[0]:t[0].toLowerCase()});
  const rk=L.indexOf('K'),bk=L.indexOf('k');
  if(rk<0||bk<0||L.lastIndexOf('K')!==rk||L.lastIndexOf('k')!==bk)return null;
  const flip=P[rk].ky<P[bk].ky,cell=(i,oc,or)=>{const c=P[i].kx+oc,r=P[i].ky+or;return flip?[9-r,8-c]:[r,c]};
  const combos=[];
  for(const a of g.cols.slice(0,4))for(const b of g.rows.slice(0,4)){
    const[r1,c1]=cell(rk,a.off,b.off),[r2,c2]=cell(bk,a.off,b.off);
    if(c1>=3&&c1<=5&&c2>=3&&c2<=5&&r1>=7&&r2<=2)combos.push({s:a.sc+b.sc,oc:a.off,or:b.off})}
  combos.sort((x,y)=>y.s-x.s);if(!combos.length)return null;
  const c0=combos[0],board=Array(90).fill('');let bad=0;
  L.forEach((l,i)=>{if(!l){bad++;return}const[r,c]=cell(i,c0.oc,c0.or);if(board[r*9+c])bad++;else board[r*9+c]=l});
  return{board,warn:bad,ambiguous:combos.length>1&&combos[1].s>0.8*c0.s,flipped:flip}}

// ---- browser part ----
// Area-average downscale (same on every browser/device, so results do not depend on the browser's own resampling).
export function boxDownscale(src,sw,sh,W,H){const out=new Uint8ClampedArray(W*H*4);
  for(let y=0;y<H;y++){const y0=Math.floor(y*sh/H),y1=Math.min(sh,Math.max(y0+1,Math.floor((y+1)*sh/H)));
    for(let x=0;x<W;x++){const x0=Math.floor(x*sw/W),x1=Math.min(sw,Math.max(x0+1,Math.floor((x+1)*sw/W)));let r=0,g=0,b=0,n=0;
      for(let yy=y0;yy<y1;yy++){let i=(yy*sw+x0)*4;for(let xx=x0;xx<x1;xx++,i+=4){r+=src[i];g+=src[i+1];b+=src[i+2];n++}}
      const o=(y*W+x)*4;out[o]=r/n;out[o+1]=g/n;out[o+2]=b/n;out[o+3]=255}}
  return out}
export async function detect(file){
  const bmp=await createImageBitmap(file),s=Math.min(1,400/bmp.width),W=Math.round(bmp.width*s),H=Math.round(bmp.height*s);
  // very large photos: first shrink with the browser's high-quality resampler, then area-average to 400px
  let sw=bmp.width,sh=bmp.height;const big=sw>1600;if(big){sh=Math.round(sh*1600/sw);sw=1600}
  const fc=document.createElement('canvas');fc.width=sw;fc.height=sh;const fx=fc.getContext('2d',{willReadFrequently:true});
  fx.fillStyle='#fff';fx.fillRect(0,0,sw,sh);fx.imageSmoothingEnabled=true;fx.imageSmoothingQuality='high';fx.drawImage(bmp,0,0,sw,sh);
  const rgba=boxDownscale(fx.getImageData(0,0,sw,sh).data,sw,sh,W,H);
  const d=detectCore(rgba,W,H);if(!d)return null;
  d.makeSheet=()=>{
  const N=d.P.length,COLS=8,CW=80,CH=96,sc=document.createElement('canvas');sc.width=COLS*CW;sc.height=Math.ceil(N/COLS)*CH;
  const g=sc.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,sc.width,sc.height);g.fillStyle='#000';g.font='bold 14px sans-serif';
  d.P.forEach((p,i)=>{const cx=(i%COLS)*CW,cy=((i/COLS)|0)*CH,h=p.r*1.15/s;g.fillText(String(i+1),cx+4,cy+14);g.drawImage(bmp,p.x/s-h,p.y/s-h,2*h,2*h,cx+4,cy+18,72,72)});
    return sc.toDataURL('image/jpeg',0.9).split(',')[1]};
  return d}

// ---- local glyph recognition (no network) ----
const samp=(a,W,H,x,y)=>{x=Math.min(Math.max(x,0),W-1.001);y=Math.min(Math.max(y,0),H-1.001);const x0=x|0,y0=y|0,fx=x-x0,fy=y-y0,o=[0,0,0];
  for(let c=0;c<3;c++){const i=(y0*W+x0)*4+c;o[c]=(a[i]*(1-fx)+a[i+4]*fx)*(1-fy)+(a[i+W*4]*(1-fx)+a[i+W*4+4]*fx)*fy}return o};
export const GN=20;
// feature = "ink strength" map (distance of each pixel from the disc's fill colour), zero-mean & unit length. sx,sy: shift in grid cells.
export function glyphVec(rgba,W,H,q,sx=0,sy=0){
  const half=0.8*q.r,px=[];
  for(let y=Math.max(0,Math.floor(q.y-q.r));y<=Math.min(H-1,q.y+q.r);y++)for(let x=Math.max(0,Math.floor(q.x-q.r));x<=Math.min(W-1,q.x+q.r);x++)
    if((x-q.x)**2+(y-q.y)**2<=(0.85*q.r)**2){const i=(y*W+x)*4;px.push([rgba[i],rgba[i+1],rgba[i+2]])}
  const f=[0,1,2].map(c=>med(px.map(v=>v[c]))),v=new Float32Array(GN*GN),cell=2*half/GN;
  for(let j=0;j<GN;j++)for(let i=0;i<GN;i++){const dx=((i+0.5)/GN*2-1)*half,dy=((j+0.5)/GN*2-1)*half;if(dx*dx+dy*dy>half*half)continue;
    const s=samp(rgba,W,H,q.x+dx+sx*cell,q.y+dy+sy*cell);v[j*GN+i]=Math.hypot(s[0]-f[0],s[1]-f[1],s[2]-f[2])}
  const nz=Array.from(v).filter(x=>x>0).sort((a,b)=>a-b),sc=Math.max(nz[Math.floor(nz.length*0.95)]||0,30);
  let m=0;for(let i=0;i<v.length;i++){v[i]=Math.min(1,v[i]/sc);m+=v[i]}m/=v.length;
  let nn=0;for(let i=0;i<v.length;i++){v[i]-=m;nn+=v[i]*v[i]}nn=Math.sqrt(nn)||1;for(let i=0;i<v.length;i++)v[i]/=nn;return v}
export const dot=(a,b)=>{let s=0;for(let i=0;i<a.length;i++)s+=a[i]*b[i];return s};
export function glyphVecs(rgba,W,H,q){const o=[];for(const sy of[-1,0,1])for(const sx of[-1,0,1])o.push(glyphVec(rgba,W,H,q,sx,sy));return o}

// ---- placement rules + count limits ----
export const CLS=['K','A','B','N','R','C','P'],CAP={K:1,A:2,B:2,N:2,R:2,C:2,P:5};
// rank = distance from the side's own back rank (0..9); c = column 0..8
export function allowed(cls,rank,c){
  if(cls==='K')return c>=3&&c<=5&&rank<=2;
  if(cls==='A')return(rank===1&&c===4)||((rank===0||rank===2)&&(c===3||c===5));
  if(cls==='B')return((rank===0||rank===4)&&(c===2||c===6))||(rank===2&&(c===0||c===4||c===8));
  if(cls==='P')return rank>=3&&(rank>=5||c%2===0);
  return true}
// small tie-breaker: puzzle positions often keep pieces on their starting squares
const BACK='RNBAKABNR';
export const startBonus=(cls,rank,c)=>(rank===0&&BACK[c]===cls)||(rank===2&&cls==='C'&&(c===1||c===7))||(rank===3&&cls==='P'&&c%2===0)?0.04:0;
// Minimum-cost assignment (Hungarian, rectangular n<=m). cost[i][j]
function hungarian(a){const n=a.length,m=a[0].length,u=Array(n+1).fill(0),v=Array(m+1).fill(0),p=Array(m+1).fill(0),way=Array(m+1).fill(0);
  for(let i=1;i<=n;i++){p[0]=i;let j0=0;const minv=Array(m+1).fill(Infinity),used=Array(m+1).fill(false);
    do{used[j0]=true;const i0=p[j0];let d=Infinity,j1=0;
      for(let j=1;j<=m;j++)if(!used[j]){const cur=a[i0-1][j-1]-u[i0]-v[j];if(cur<minv[j]){minv[j]=cur;way[j]=j0}if(minv[j]<d){d=minv[j];j1=j}}
      for(let j=0;j<=m;j++)if(used[j]){u[p[j]]+=d;v[j]-=d}else minv[j]-=d;j0=j1}while(p[j0]!==0);
    do{const j1=way[j0];p[j0]=p[j1];j0=j1}while(j0)}
  const r=Array(n).fill(-1);for(let j=1;j<=m;j++)if(p[j])r[p[j]-1]=j-1;return r}
// scores[i][cls] = similarity; pos[i]=[rank,c]. Returns {cls:[...], bad, total} for one side.
export function assignSide(scores,pos){
  const slots=[];for(const c of CLS)for(let k=0;k<CAP[c];k++)slots.push(c);
  if(scores.length>slots.length)return null;
  const BIG=10,cost=scores.map((s,i)=>slots.map(c=>allowed(c,pos[i][0],pos[i][1])?-s[c]-(c==='K'?3:0)-startBonus(c,pos[i][0],pos[i][1]):BIG)); // every side has exactly one general: bonus forces the K slot to be used
  if(!cost.length)return{cls:[],bad:0,total:0};
  const r=hungarian(cost);let tot=0,bad=0;r.forEach((j,i)=>{tot+=cost[i][j]+(slots[j]==='K'?3:0)+startBonus(slots[j],pos[i][0],pos[i][1]);if(cost[i][j]>=BIG)bad++});
  return{cls:r.map(j=>slots[j]),bad,total:-tot}}

export const decodeTemplates=(raw,u=false)=>raw.map(t=>{const b=atob(t.d),v=new Float32Array(GN*GN);for(let i=0;i<v.length;i++)v[i]=((b.charCodeAt(i)<<24)>>24)*t.s;return{cls:t.c,v,u}});
// Fully local recognition. Returns null if red/black cannot be told apart. TP = decoded templates.
export function recognize(d,TP){
  const{P,g,W,H,rgba}=d,isRed=i=>P[i].rs>35;
  if(!P.some(p=>p.rs>35)||!P.some(p=>p.rs<=35))return null;
  const V=P.map(q=>glyphVecs(rgba,W,H,q)),R=V.map(vs=>vs.map(v=>Float32Array.from(v).reverse())); // R: same glyphs turned 180 degrees (board seen from the other side)
  const sim=(i,v0)=>{let m=-1;for(const v of V[i])m=Math.max(m,dot(v,v0));for(const v of R[i])m=Math.max(m,dot(v,v0)-0.05);return m};
  const UB=[],S0=P.map((q,i)=>{const ob=Object.fromEntries(CLS.map(c=>[c,-1])),ou=Object.fromEntries(CLS.map(c=>[c,-1]));
    for(const m of TP){const s=sim(i,m.v),t=m.u?ou:ob;if(s>t[m.cls])t[m.cls]=s}UB.push([ob,ou]);return Object.fromEntries(CLS.map(c=>[c,Math.max(ob[c],ou[c])]))});
  const S=S0.map((o,i)=>{const grp=P.map((u,j)=>j).filter(j=>isRed(j)===isRed(i)&&(j===i||sim(i,V[j][4])>0.85));
    return Object.fromEntries(CLS.map(c=>[c,grp.reduce((a,j)=>a+S0[j][c],0)/grp.length]))});
  const lineBest=Math.max(1,g.cols[0].sc+g.rows[0].sc),H_=[];
  for(const flip of[false,true])for(const a of g.cols.slice(0,4))for(const b of g.rows.slice(0,4)){
    const cells=P.map(q=>{const c=q.kx+a.off,r=q.ky+b.off;return flip?[9-r,8-c]:[r,c]});
    let tot=0,bad=0;const cls=Array(P.length).fill('?');
    for(const red of[true,false]){const idx=P.map((q,i)=>i).filter(i=>isRed(i)===red);
      const as=assignSide(idx.map(i=>S[i]),idx.map(i=>[red?9-cells[i][0]:cells[i][0],cells[i][1]]));if(!as){bad+=99;continue}
      as.cls.forEach((c,k)=>cls[idx[k]]=c);tot+=as.total;bad+=as.bad}
    if(new Set(cells.map(c=>c[0]*9+c[1])).size<cells.length)bad+=99;
    H_.push({score:tot/P.length-0.5*bad+0.3*Math.max(0,a.sc+b.sc)/lineBest,bad,cells,cls,flip})}
  H_.sort((x,y)=>y.score-x.score);const h=H_[0],sims=P.map((q,i)=>S[i][h.cls[i]]);
  const board=Array(90).fill('');P.forEach((q,i)=>{const[r,c]=h.cells[i];board[r*9+c]=isRed(i)?h.cls[i]:h.cls[i].toLowerCase()});
  const unsure=P.map((q,i)=>{const[r,c]=h.cells[i],rank=isRed(i)?9-r:r;let alt=-1;for(const k of CLS)if(k!==h.cls[i]&&allowed(k,rank,c))alt=Math.max(alt,S[i][k]);return sims[i]-alt<0.05||sims[i]<0.3});
  const info={};P.forEach((q,i)=>{const[r,c]=h.cells[i],rank=isRed(i)?9-r:r;
    info[r*9+c]={cls:h.cls[i],user:UB[i][1][h.cls[i]]>UB[i][0][h.cls[i]]+0.02,alts:CLS.filter(k=>k!==h.cls[i]&&allowed(k,rank,c)).sort((x,y)=>S[i][y]-S[i][x]).slice(0,3),vec:V[i][4]}});
  return{info,board,unsure:unsure.map((u,i)=>u?h.cells[i][0]*9+h.cells[i][1]:-1).filter(x=>x>=0),bad:h.bad,minSim:Math.min(...sims),meanSim:sims.reduce((a,b)=>a+b,0)/sims.length,margin:H_.length>1?h.score-H_[1].score:1,flipped:h.flip}}

// ---- learning from the user's corrections ----
export function packTemplate(cls,v){let m=0;for(const x of v)m=Math.max(m,Math.abs(x));const sc=m/127||1;let t='';
  for(const x of v)t+=String.fromCharCode(Math.max(-127,Math.min(127,Math.round(x/sc)))&255);return{c:cls,s:+sc.toPrecision(6),d:btoa(t)}}
// pieces the user changed after a scan: [{cell, from, to, vec}] (info = recognize().info, board = current board)
export function corrections(info,board){const out=[],keys=Object.keys(info);
  if(keys.filter(k=>board[+k]).length<0.7*keys.length||board.filter(Boolean).length>keys.length+2)return out;   // the board was rebuilt, not corrected
  for(const k of keys){const f=board[+k];if(!f)continue;const to=f.toUpperCase();if(to!==info[k].cls)out.push({cell:+k,from:info[k].cls,to,vec:info[k].vec})}return out}
// choice: a class letter, 'x' (remove) or 'pal' (use the palette piece); the piece keeps its colour when a class is chosen
export function fixCell(board,cell,choice,pal){const n=board.slice(),cur=n[cell];if(!cur)return n;
  if(choice==='x'){n[cell]='';return n}if(choice==='pal'){n[cell]=pal&&pal!=='x'?pal:cur;return n}
  n[cell]=cur===cur.toUpperCase()?choice:choice.toLowerCase();return n}
const UKEY='xq_user_templates_v2';   // v1 (automatic learning) is discarded: it could store accidental edits
try{localStorage.removeItem('xq_user_templates_v1')}catch(e){}
export function loadUserTemplates(){try{return JSON.parse(localStorage.getItem(UKEY)||'[]')}catch(e){return[]}}
export function addUserTemplates(list){try{const all=[...loadUserTemplates(),...list].slice(-400);localStorage.setItem(UKEY,JSON.stringify(all));return all.length}catch(e){return 0}}
export function clearUserTemplates(){try{localStorage.removeItem(UKEY)}catch(e){}}
