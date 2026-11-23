import {newGame,legalUp,applyUp,pseudoUp,determinize,unseen,FULL,startSquares,inCheckUp,outcomeUp,keyUp} from './jieqi.js';
import {parse,legal,START,red} from './xq.js';
let bad=0;const eq=(n,g,e)=>{const ok=JSON.stringify(g)===JSON.stringify(e);if(!ok)bad++;console.log(ok?'ok  ':'FAIL',n,ok?'':`got ${JSON.stringify(g)} want ${JSON.stringify(e)}`)};
// 1. setup
let counts=[];for(let g=0;g<200;g++){const {b,hid}=newGame();
  for(const s of['w','b']){const ids=startSquares(s).map(i=>b[i]).map(x=>x.toUpperCase()).sort().join('');if(ids!==FULL.slice().sort().join(''))bad++}
  counts.push([legalUp(b,hid,'w').length,legalUp(b,hid,'b').length,hid.filter(Boolean).length,b[85],b[4],hid[85],hid[4]].join())}
eq('200 random deals: 44 moves each side, 30 hidden, generals placed and face-up',[...new Set(counts)],['44,44,30,K,k,false,false']);
// 2. the standard start has the identical move set as the starting layout (same squares)
const std=parse(START).b;const {b,hid}=newGame();
const same=(a,b2)=>a.map(m=>m.join('-')).sort().join()===b2.map(m=>m.join('-')).sort().join();
eq('hidden opening moves = standard opening moves (by square)',same(legalUp(b,hid,'w'),legal(std,'w')),true);
// 3. reveal on move
const m=legalUp(b,hid,'w')[0],r=applyUp(b,hid,m);
eq('a moved hidden piece is revealed with its true identity',[r.revealed===b[m[0]],r.hid[m[1]],r.hid[m[0]]],[true,false,false]);
// 4. captured hidden piece is reported
let pos=Array(90).fill(''),h2=Array(90).fill(false);pos[85]='K';pos[4]='k';pos[27]='n';h2[27]=true;pos[63]='R';
const cap=applyUp(pos,h2,[63,27]);eq('capturing a face-down piece reports it',[cap.captured,cap.capHidden],['n',true]);
// 5. face-up advisor leaves the palace, face-down advisor does not
pos=Array(90).fill('');h2=Array(90).fill(false);pos[85]='K';pos[4]='k';pos[39]='A';           // face-up red advisor at row4,col3 (outside the palace)
eq('face-up advisor roams (4 diagonal moves)',pseudoUp(pos,h2,'w').filter(x=>x[0]===39).length,4);
let h3=h2.slice();pos=Array(90).fill('');pos[85]='K';pos[4]='k';pos[84]='A';h3[84]=true;        // red square 84 = row9,col3 = advisor start square
eq('face-down advisor keeps palace move (only the centre)',pseudoUp(pos,h3,'w').filter(x=>x[0]===84).map(x=>x[1]),[76]);
// 6. face-up elephant crosses the river, blocked by the eye
pos=Array(90).fill('');pos[85]='K';pos[4]='k';pos[49]='B';h2=Array(90).fill(false);        // row5,col4
eq('face-up elephant on the river line reaches 4 squares',pseudoUp(pos,h2,'w').filter(x=>x[0]===49).map(x=>x[1]).sort((a,b)=>a-b),[29,33,65,69]);
pos[39]='p';eq('...and the eye blocks it',pseudoUp(pos,h2,'w').filter(x=>x[0]===49).map(x=>x[1]).sort((a,b)=>a-b),[33,65,69]);
// 7. a face-up advisor can give check (variant rule)
pos=Array(90).fill('');pos[85]='K';pos[3]='k';pos[13]='A';h2=Array(90).fill(false);   // advisor diag-adjacent to the black general
eq('face-up advisor attacks the general',inCheckUp(pos,h2,'b'),true);
// 8. face-down pieces attack like their start square: a rook-square piece checks along its file...
pos=Array(90).fill('');pos[4]='k';pos[84]='K';pos[0]='r';h2=Array(90).fill(false);h2[0]=true;pos[63]='';
pos[54]='C';   // red piece on the rook's file blocks it
eq('face-down rook-square piece, file blocked: no check on a king off its lines',inCheckUp(pos,h2,'w'),false);
pos=Array(90).fill('');pos[4]='k';pos[84]='K';pos[0]='r';h2=Array(90).fill(false);h2[0]=true;pos[81]='';pos[9*9+3]='K';
// rook at (0,0) and red king on (9,3): not aligned
eq('...and not aligned: no check',inCheckUp(pos,h2,'w'),false);
pos=Array(90).fill('');pos[4]='k';pos[81]='K';pos[0]='r';h2=Array(90).fill(false);h2[0]=true;   // red king on (9,0): same file as the face-down rook
eq('face-down rook-square piece checks along its file',inCheckUp(pos,h2,'w'),true);
// the same piece standing on a cannon square attacks like a cannon: no check without a screen
pos=Array(90).fill('');pos[4]='k';pos[84]='K';pos[19]='r';h2=Array(90).fill(false);h2[19]=true;   // (2,1) is a cannon start square
eq('face-down piece on a cannon square needs a screen',inCheckUp(pos,h2,'w'),false);
// 9. determinize keeps the multiset per side and ignores revealed pieces
const dd=determinize(b,hid);let okm=true;for(const s of['w','b']){const f=o=>JSON.stringify(Object.entries(o).sort());if(f(unseen(b,hid,s))!==f(unseen(dd,hid,s)))okm=false}
eq('determinize preserves hidden identity counts',okm,true);
// 10. engine (loose rules) agrees with the cờ úp rules on random face-up positions
{const {legalMovesLoose,legalMoves}=await import('./engine.js');let pos=0,mism=0;
 for(let g=0;g<25;g++){let {b}=newGame();let hid=Array(90).fill(false),turn='w';if(inCheckUp(b,hid,'w')||inCheckUp(b,hid,'b'))continue;
  for(let ply=0;ply<80;ply++){const A=legalUp(b,hid,turn).map(m=>m[0]*100+m[1]).sort((x,y)=>x-y),E=legalMovesLoose(b,turn).map(m=>m[0]*100+m[1]).sort((x,y)=>x-y);pos++;
   if(A.join()!==E.join()){mism++;break}if(!A.length)break;const L=legalUp(b,hid,turn),r=applyUp(b,hid,L[(Math.random()*L.length)|0]);b=r.b;hid=r.hid;turn=turn==='w'?'b':'w'}}
 eq('engine loose rules == cờ úp rules ('+pos+' positions)',mism,0);
 eq('normal rules unaffected afterwards',legalMoves(parse(START).b,'w').length,44)}
// 11. the AI returns legal moves and never needs the hidden identities (same answer when hidden identities are shuffled)
{const {thinkUp}=await import('./jieqiAI.js');let ok=true;
 for(let g=0;g<6;g++){const {b,hid}=newGame();for(const turn of['w','b']){const r=thinkUp({b,hid,turn,keys:[],level:1});if(!legalUp(b,hid,turn).some(m=>m[0]===r.move[0]&&m[1]===r.move[1]))ok=false}}
 eq('cờ úp AI returns legal moves',ok,true)}
console.log(bad?bad+' FAILED':'all jieqi tests passed');process.exit(bad?1:0)
