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

// ---- extra rules: check info, repetition, perpetual check, draws ----
export const kingOf=(b,turn)=>b.indexOf(turn==='w'?'K':'k');
// squares of the pieces currently giving check to the side to move (includes the opposing general in a "flying general" face-off)
export function checkers(b,turn){const k=kingOf(b,turn);if(k<0)return[];
  const o=pseudo(b,turn==='w'?'b':'w').filter(m=>m[1]===k).map(m=>m[0]),ok2=b.indexOf(turn==='w'?'k':'K');
  if(ok2>=0&&ok2%9===k%9){let free=true;for(let j=Math.min(k,ok2)+9;j<Math.max(k,ok2);j+=9)if(b[j]){free=false;break}if(free)o.push(ok2)}return o}
// ---- perpetual chase (simplified Asian-rules model) ----
// A "chase" = a move that creates a NEW threat to capture an enemy piece profitably: the target is not a general, not an
// uncrossed pawn, is either undefended or worth more than the attacker, and cannot simply capture the attacker back.
// Generals and pawns never count as chasers.
const CV={r:9,c:4.5,n:4,a:2,b:2,p:1,k:100};
function chaseTargets(b,x){const opp=x==='w'?'b':'w',set=new Set(),back=new Set();
  for(const q of legal(b,opp))if(b[q[1]])back.add(q[0]*100+q[1]);
  for(const m of legal(b,x)){const tg=b[m[1]];if(!tg)continue;const at=b[m[0]].toLowerCase(),tt=tg.toLowerCase();
    if(at==='k'||at==='p'||tt==='k')continue;
    if(tt==='p'&&!(red(tg)?(m[1]/9|0)<=4:(m[1]/9|0)>=5))continue;
    if(back.has(m[1]*100+m[0]))continue;
    if(legal(apply(b,m),opp).some(q=>q[1]===m[1])&&CV[at]>=CV[tt])continue;
    set.add(m[1])}
  return set}
// what the side that just moved did in state k: 'check' | 'chase' | 'none'
function moveKind(tl,k){const x=tl[k].turn==='w'?'b':'w';if(inCheck(tl[k].b,tl[k].turn))return'check';
  const before=chaseTargets(tl[k-1].b,x),after=chaseTargets(tl[k].b,x);for(const t of after)if(!before.has(t))return'chase';return'none'}
const rankOf=kinds=>kinds.length&&kinds.every(k=>k==='check')?2:kinds.length&&kinds.every(k=>k!=='none')&&kinds.includes('chase')?1:0;

// tl = [{b,turn,cap}] from the oldest known position to the current one (cap = the move that led here captured a piece).
// Returns null while the game goes on, otherwise {text, winner:'w'|'b'|null}.
export function outcome(tl){
  const c=tl.length-1,cur=tl[c];
  if(!cur.b.some(p=>'rncpRNCP'.includes(p)))return{text:'Draw: no attacking pieces left',winner:null};
  let q=0;for(let i=c;i>0&&!tl[i].cap;i--)q++;if(q>=120)return{text:'Draw: 60 moves without a capture',winner:null};
  const key=toFen(cur.b,cur.turn),same=[];for(let i=0;i<=c;i++)if(toFen(tl[i].b,tl[i].turn)===key)same.push(i);
  if(same.length>=3){const p=same[same.length-2],mine=[],theirs=[];
    for(let k=p+1;k<=c;k++)((c-k)%2===0?mine:theirs).push(moveKind(tl,k));
    const rm=rankOf(mine),rt=rankOf(theirs),stm=cur.turn,mover=stm==='w'?'b':'w',name=s=>s==='w'?'Red':'Black';
    if(rm!==rt){const loser=rm>rt?mover:stm,r=Math.max(rm,rt);
      return{text:`${name(loser)} loses: perpetual ${r===2?'check':'chase'} (it is not allowed to repeat it)`,winner:loser==='w'?'b':'w'}}
    return{text:'Draw: the same position occurred 3 times',winner:null}}
  return null}
