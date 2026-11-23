// Cờ úp (jieqi) rules. State = { b: 90 chars, hid: 90 booleans }.
// b always holds each piece's TRUE identity; hid[i] says it is still face-down. The UI must never draw a hidden identity,
// and the AI never uses it (it only uses the multiset of hidden identities, which is public information).
//
// Rules (as on clubxiangqi.com, the source I could verify):
//  - Everything except the two generals starts face-down on the usual starting squares, identities shuffled per side.
//  - A face-down piece moves like the piece that normally starts on its square (rook square -> rook, ...). After that one move it is
//    turned face-up and moves as what it really is. Captured pieces are revealed.
//  - Face-up advisors are NOT restricted to the palace and face-up elephants are NOT restricted to their own half (this variant).
//  - Face-down pieces attack (check) with the move of their square; generals are never hidden; flying-general rule unchanged.
//  - Red moves first. Win by checkmate or stalemate (no legal move). Draws: 3-fold repetition (perpetual check loses),
//    120 plies without a capture, only generals left. (Perpetual *chase* is not implemented for this mode.)
import {red} from './xq.js';

export const FULL=['R','R','N','N','B','B','A','A','C','C','P','P','P','P','P'];
const BACK='rnbakabnr';
// piece type that normally starts on square i (null = general / empty point)
export function posType(i){const r=(i/9)|0,c=i%9;
  if(r===0||r===9){const t=BACK[c];return t==='k'?null:t}
  if(r===2||r===7)return(c===1||c===7)?'c':null;
  if(r===3||r===6)return c%2===0?'p':null;
  return null}
const RED_ROWS=[6,7,9],BLACK_ROWS=[0,2,3];
export const startSquares=side=>{const o=[];for(const r of side==='w'?RED_ROWS:BLACK_ROWS)for(let c=0;c<9;c++)if(posType(r*9+c))o.push(r*9+c);return o};

const shuffle=(a,rng)=>{for(let i=a.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
export function newGame(rng=Math.random){const b=Array(90).fill(''),hid=Array(90).fill(false);b[85]='K';b[4]='k';
  for(const side of['w','b']){const sq=startSquares(side),ids=shuffle(FULL.slice(),rng);
    sq.forEach((s,k)=>{b[s]=side==='w'?ids[k]:ids[k].toLowerCase();hid[s]=true})}
  return{b,hid}}

const O=[[1,0],[-1,0],[0,1],[0,-1]],D=[[1,1],[1,-1],[-1,1],[-1,-1]],ok=(r,c)=>r>=0&&r<10&&c>=0&&c<9;
export function pseudoUp(b,hid,side){const W=side==='w',M=[];
  for(let i=0;i<90;i++){const p=b[i];if(!p||red(p)!==W)continue;const h=hid[i],t=h?posType(i):p.toLowerCase(),r=(i/9)|0,c=i%9;
    const add=(R,C)=>{if(!ok(R,C))return;const q=b[R*9+C];if(q&&red(q)===W)return;M.push([i,R*9+C])};
    const pal=(R,C)=>C>=3&&C<=5&&(W?R>=7&&R<=9:R>=0&&R<=2);
    if(t==='k')O.forEach(([a,d])=>pal(r+a,c+d)&&add(r+a,c+d));
    else if(t==='a')D.forEach(([a,d])=>{if(!h||pal(r+a,c+d))add(r+a,c+d)});            // face-up advisors roam freely
    else if(t==='b')D.forEach(([a,d])=>{const R=r+2*a,C=c+2*d;if(ok(R,C)&&!b[(r+a)*9+c+d]&&(!h||(W?R>=5:R<=4)))add(R,C)});   // face-up elephants cross the river
    else if(t==='n')O.forEach(([a,d])=>{if(!ok(r+a,c+d)||b[(r+a)*9+c+d])return;(a?[[r+2*a,c-1],[r+2*a,c+1]]:[[r-1,c+2*d],[r+1,c+2*d]]).forEach(([R,C])=>add(R,C))});
    else if(t==='r'||t==='c')O.forEach(([a,d])=>{let R=r+a,C=c+d,scr=false;while(ok(R,C)){const q=b[R*9+C];
      if(t==='r'){add(R,C);if(q)break}else if(!scr){if(q)scr=true;else add(R,C)}else if(q){add(R,C);break}R+=a;C+=d}});
    else{const f=W?-1:1;add(r+f,c);if(W?r<=4:r>=5){add(r,c-1);add(r,c+1)}}}
  return M}

export const kingSq=(b,side)=>b.indexOf(side==='w'?'K':'k');
export function facing(b){const a=b.indexOf('K'),k=b.indexOf('k');if(a<0||k<0||a%9!==k%9)return false;for(let j=Math.min(a,k)+9;j<Math.max(a,k);j+=9)if(b[j])return false;return true}
export function inCheckUp(b,hid,side){const ki=kingSq(b,side);if(ki<0)return true;if(facing(b))return true;
  return pseudoUp(b,hid,side==='w'?'b':'w').some(m=>m[1]===ki)}
// squares of pieces attacking the given side's general (for highlighting)
export function checkersUp(b,hid,side){const ki=kingSq(b,side);if(ki<0)return[];const o=pseudoUp(b,hid,side==='w'?'b':'w').filter(m=>m[1]===ki).map(m=>m[0]);
  const ok2=kingSq(b,side==='w'?'b':'w');if(facing(b)&&ok2>=0)o.push(ok2);return o}

// returns the new state plus what happened: revealed = identity just turned face-up (or null), captured = piece removed (or '')
export function applyUp(b,hid,m){const nb=b.slice(),nh=hid.slice(),captured=nb[m[1]],capHidden=!!hid[m[1]],revealed=hid[m[0]]?nb[m[0]]:null;
  nb[m[1]]=nb[m[0]];nb[m[0]]='';nh[m[1]]=false;nh[m[0]]=false;return{b:nb,hid:nh,revealed,captured,capHidden}}
export const legalUp=(b,hid,side)=>pseudoUp(b,hid,side).filter(m=>{const n=applyUp(b,hid,m);return!inCheckUp(n.b,n.hid,side)});

export const keyUp=(b,hid,turn)=>b.map((p,i)=>p?(hid[i]?'?':p):'.').join('')+turn;

// tl = [{b,hid,turn,cap}] oldest..current (cap = the move that led here captured something)
export function outcomeUp(tl){const c=tl.length-1,cur=tl[c];
  if(cur.b.every(p=>!p||p==='K'||p==='k'))return{text:'Draw: only the generals are left',winner:null};
  let q=0;for(let i=c;i>0&&!tl[i].cap;i--)q++;if(q>=120)return{text:'Draw: 60 moves without a capture',winner:null};
  const key=keyUp(cur.b,cur.hid,cur.turn),same=[];for(let i=0;i<=c;i++)if(keyUp(tl[i].b,tl[i].hid,tl[i].turn)===key)same.push(i);
  if(same.length>=3){const p=same[same.length-2];let mine=true,theirs=true;
    for(let k=p+1;k<=c;k++){const g=inCheckUp(tl[k].b,tl[k].hid,tl[k].turn);if((c-k)%2===0){if(!g)mine=false}else if(!g)theirs=false}
    const stm=cur.turn,mover=stm==='w'?'b':'w',name=s=>s==='w'?'Red':'Black';
    if(mine&&!theirs)return{text:`${name(mover)} loses: perpetual check (it is not allowed to repeat it)`,winner:stm};
    if(theirs&&!mine)return{text:`${name(stm)} loses: perpetual check (it is not allowed to repeat it)`,winner:mover};
    return{text:'Draw: the same position occurred 3 times',winner:null}}
  return null}

// ---- what the unseen identities could be (public information only) ----
// Returns a copy of b where, for each side separately, the hidden identities are randomly re-dealt among that side's face-down squares.
export function determinize(b,hid,rng=Math.random){const nb=b.slice();
  for(const side of['w','b']){const sq=[];for(let i=0;i<90;i++)if(hid[i]&&b[i]&&(red(b[i])===(side==='w')))sq.push(i);
    const ids=shuffle(sq.map(i=>b[i]),rng);sq.forEach((s,k)=>{nb[s]=ids[k]})}
  return nb}
// how many of each identity are still face-down for a side, e.g. {R:2,N:1,...}
export function unseen(b,hid,side){const o={};for(let i=0;i<90;i++)if(hid[i]&&b[i]&&(red(b[i])===(side==='w'))){const k=b[i].toUpperCase();o[k]=(o[k]||0)+1}return o}
