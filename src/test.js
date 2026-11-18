import {parse,START,legal,apply,toFen,outcome} from './xq.js';
import {perft,think} from './engine.js';
import {notes} from './notation.js';
import {corrections,fixCell,startBonus,packTemplate,decodeTemplates} from './vision.js';
const {b}=parse(START);let fail=0;const eq=(name,got,exp)=>{const ok=JSON.stringify(got)===JSON.stringify(exp);if(!ok)fail++;console.log(ok?'ok  ':'FAIL',name,ok?'':`got ${JSON.stringify(got)} expected ${JSON.stringify(exp)}`)};
eq('rules: red moves at start',legal(b,'w').length,44);
eq('engine perft 1..3',[1,2,3].map(d=>perft(b,'w',d)),[44,1920,79666]);
eq('fen roundtrip',toFen(b,'w'),START);
// perpetual check: a rook that checks every move while the king just steps aside loses on the 3rd repetition
let st=parse('3k5/9/9/9/9/4R4/9/9/9/5K3 w'),bb=st.b,turn='w';const tl=[{b:bb,turn,cap:false}];
for(let i=0;i<2;i++)for(const m of[[49,48],[3,4],[48,49],[4,3]]){bb=apply(bb,m);turn=turn==='w'?'b':'w';tl.push({b:bb,turn,cap:false})}
eq('perpetual check loses',outcome(tl)?.winner,'b');
// perpetual chase: a rook that keeps attacking an undefended cannon (which just steps off the rook's rank) loses
{let st2=parse('3k5/9/9/9/9/9/9/R7c/9/5K3 b'),b2=st2.b,t2='b';const tl2=[{b:b2,turn:t2,cap:false}];
 for(let i=0;i<2;i++)for(const m of[[71,62],[63,54],[62,71],[54,63]]){b2=apply(b2,m);t2=t2==='w'?'b':'w';tl2.push({b:b2,turn:t2,cap:false})}
 eq('perpetual chase loses',outcome(tl2)?.winner,'b')}
// plain repetition with no threats is a draw
{let st3=parse('3k5/9/9/9/9/9/9/9/9/5K3 w'),b3=st3.b,t3='w';const tl3=[{b:b3,turn:t3,cap:false}];
 for(let i=0;i<2;i++)for(const m of[[86,85],[3,4],[85,86],[4,3]]){b3=apply(b3,m);t3=t3==='w'?'b':'w';tl3.push({b:b3,turn:t3,cap:false})}
 eq('plain repetition is a draw',outcome(tl3)?.winner,null);eq('...and is reported',!!outcome(tl3),true)}
// notation
{let b4=parse(START).b,t4='w';const sts=[{b:b4,turn:t4,last:null}];
 for(const[f,t]of[[70,67],[1,20],[67,31]]){const m=legal(b4,t4).find(x=>x[0]===f&&x[1]===t);b4=apply(b4,m);t4=t4==='w'?'b':'w';sts.push({b:b4,turn:t4,last:m})}
 eq('move notation',notes(sts),['Ch2-e2','Nb9-c7','Ce2xe6'])}
// scan correction helpers
{const vec=Float32Array.from({length:400},(_,i)=>Math.sin(i)*0.05),info={};const bd=Array(90).fill('');
 for(let i=0;i<10;i++){info[i]={cls:'P',alts:['N'],vec};bd[i]='p'}bd[5]='n';
 eq('a changed piece is listed',corrections(info,bd).map(c=>c.from+'>'+c.to),['P>N']);
 eq('templates keep the user flag',decodeTemplates([packTemplate('N',vec)],true)[0].u,true);
 eq('a rebuilt board is not listed',corrections(info,Array(90).fill('r')).length,0);
 eq('fix keeps the piece colour',[fixCell(['p'],0,'N')[0],fixCell(['P'],0,'N')[0]],['n','N']);
 eq('start-square prior',[startBonus('R',0,0)>0,startBonus('C',2,1)>0,startBonus('R',4,4)],[true,true,0])}
const r=think({b,turn:'w',timeline:[{b,turn:'w'}],level:3});console.log('engine Hard: depth',r.depth,'in',r.ms,'ms, move',r.move);
eq('engine returns a legal move',legal(b,'w').some(m=>m[0]===r.move[0]&&m[1]===r.move[1]),true);
if(fail){console.log(fail,'test(s) failed');process.exit(1)}console.log('all tests passed');
