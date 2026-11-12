// Xiangqi rules + search. Board = 90-cell array, row 0 = Black's back rank. Uppercase = Red ('w', moves first).
export const START='rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w';
export const red=p=>p>='A'&&p<='Z';
export function parse(f){const[s,t]=f.trim().split(/\s+/);const b=[];for(const ch of s||''){if(ch==='/')continue;if(ch>='0'&&ch<='9')for(let i=0;i<+ch;i++)b.push('');else if('rnbakcpRNBAKCP'.includes(ch))b.push(ch);else return null}return b.length===90?{b,turn:t==='b'?'b':'w'}:null}
// Forgiving parser for scanned FENs: pads/truncates rows to 9 columns and pads missing ranks. fixed=true if anything was repaired.
export function parseLoose(f){const[s,t]=(f||'').trim().split(/\s+/);const rows=(s||'').split('/');if(rows.length<5||rows.length>12)return null;
let fixed=rows.length!==10;const b=[];
for(let r=0;r<10;r++){const row=[];for(const ch of rows[r]||''){if(ch>='0'&&ch<='9')for(let i=0;i<+ch;i++)row.push('');else if('rnbakcpRNBAKCP'.includes(ch))row.push(ch);else return null}
if(row.length!==9)fixed=true;while(row.length<9)row.push('');b.push(...row.slice(0,9))}
return{b,turn:t==='b'?'b':'w',fixed}}
export function toFen(b,turn){const o=[];for(let r=0;r<10;r++){let s='',n=0;for(let c=0;c<9;c++){const p=b[r*9+c];if(p){if(n)s+=n;n=0;s+=p}else n++}if(n)s+=n;o.push(s)}return o.join('/')+' '+turn}
const O=[[1,0],[-1,0],[0,1],[0,-1]],D=[[1,1],[1,-1],[-1,1],[-1,-1]],ok=(r,c)=>r>=0&&r<10&&c>=0&&c<9;
export function pseudo(b,side){const W=side==='w',M=[];
for(let i=0;i<90;i++){const p=b[i];if(!p||red(p)!==W)continue;const t=p.toLowerCase(),r=i/9|0,c=i%9;
const add=(R,C)=>{if(!ok(R,C))return;const q=b[R*9+C];if(q&&red(q)===W)return;M.push([i,R*9+C])};
const pal=(R,C)=>C>=3&&C<=5&&(W?R>=7&&R<=9:R>=0&&R<=2);
if(t==='k')O.forEach(([a,d])=>pal(r+a,c+d)&&add(r+a,c+d));
else if(t==='a')D.forEach(([a,d])=>pal(r+a,c+d)&&add(r+a,c+d));
else if(t==='b')D.forEach(([a,d])=>{const R=r+2*a,C=c+2*d;if(ok(R,C)&&!b[(r+a)*9+c+d]&&(W?R>=5:R<=4))add(R,C)});
else if(t==='n')O.forEach(([a,d])=>{if(!ok(r+a,c+d)||b[(r+a)*9+c+d])return;(a?[[r+2*a,c-1],[r+2*a,c+1]]:[[r-1,c+2*d],[r+1,c+2*d]]).forEach(([R,C])=>add(R,C))});
else if(t==='r'||t==='c')O.forEach(([a,d])=>{let R=r+a,C=c+d,scr=false;while(ok(R,C)){const q=b[R*9+C];
 if(t==='r'){add(R,C);if(q)break}else if(!scr){if(q)scr=true;else add(R,C)}else if(q){add(R,C);break}R+=a;C+=d}});
else{const f=W?-1:1;add(r+f,c);if(W?r<=4:r>=5){add(r,c-1);add(r,c+1)}}}
return M}
export function inCheck(b,side){const ki=b.indexOf(side==='w'?'K':'k'),oi=b.indexOf(side==='w'?'k':'K');if(ki<0)return true;
if(oi>=0&&oi%9===ki%9){let free=true;for(let j=Math.min(ki,oi)+9;j<Math.max(ki,oi);j+=9)if(b[j]){free=false;break}if(free)return true}
return pseudo(b,side==='w'?'b':'w').some(m=>m[1]===ki)}
export const apply=(b,[f,t])=>{const n=b.slice();n[t]=n[f];n[f]='';return n};
export const legal=(b,side)=>pseudo(b,side).filter(m=>!inCheck(apply(b,m),side));
const V={r:900,c:450,n:400,b:200,a:200,p:100,k:0};
function ev(b,side){let s=0;for(let i=0;i<90;i++){const p=b[i];if(!p)continue;const t=p.toLowerCase(),r=i/9|0;let v=V[t];
if(t==='p'){const adv=red(p)?9-r:r;if(adv>4)v+=(adv-4)*20}if('rnc'.includes(t))v+=10-Math.abs(4-i%9)*2;s+=red(p)?v:-v}return side==='w'?s:-s}
const cv=(b,m)=>b[m[1]]?V[b[m[1]].toLowerCase()]:0;
function nm(b,side,d,a,be,ply){const ms=legal(b,side);if(!ms.length)return -99999+ply;if(d===0)return ev(b,side);
ms.sort((x,y)=>cv(b,y)-cv(b,x));for(const m of ms){const s=-nm(apply(b,m),side==='w'?'b':'w',d-1,-be,-a,ply+1);if(s>=be)return be;if(s>a)a=s}return a}
export function best(b,side,depth,noise=0){const ms=legal(b,side);if(!ms.length)return null;ms.sort((x,y)=>cv(b,y)-cv(b,x));
let bm=ms[0],bs=-Infinity;for(const m of ms){const s=-nm(apply(b,m),side==='w'?'b':'w',depth-1,-1e9,noise||bs===-Infinity?1e9:-bs,1)+Math.random()*noise;if(s>bs){bs=s;bm=m}}return bm}
