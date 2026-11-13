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
  P.forEach((q,i)=>{q.kx=g.kx[i];q.ky=g.ky[i]});return{P,g,W,H}}

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
export async function detect(file){
  const bmp=await createImageBitmap(file),s=Math.min(1,400/bmp.width),W=Math.round(bmp.width*s),H=Math.round(bmp.height*s);
  const c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d',{willReadFrequently:true});
  x.fillStyle='#fff';x.fillRect(0,0,W,H);x.drawImage(bmp,0,0,W,H);
  const d=detectCore(x.getImageData(0,0,W,H).data,W,H);if(!d)return null;
  const N=d.P.length,COLS=8,CW=80,CH=96,sc=document.createElement('canvas');sc.width=COLS*CW;sc.height=Math.ceil(N/COLS)*CH;
  const g=sc.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,sc.width,sc.height);g.fillStyle='#000';g.font='bold 14px sans-serif';
  d.P.forEach((p,i)=>{const cx=(i%COLS)*CW,cy=((i/COLS)|0)*CH,h=p.r*1.15/s;g.fillText(String(i+1),cx+4,cy+14);g.drawImage(bmp,p.x/s-h,p.y/s-h,2*h,2*h,cx+4,cy+18,72,72)});
  d.sheet=sc.toDataURL('image/jpeg',0.9).split(',')[1];return d}
