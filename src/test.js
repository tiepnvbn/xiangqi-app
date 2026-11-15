import {parse,START,legal,apply,toFen,outcome} from './xq.js';
import {perft,think} from './engine.js';
const {b}=parse(START);let fail=0;const eq=(name,got,exp)=>{const ok=JSON.stringify(got)===JSON.stringify(exp);if(!ok)fail++;console.log(ok?'ok  ':'FAIL',name,ok?'':`got ${JSON.stringify(got)} expected ${JSON.stringify(exp)}`)};
eq('rules: red moves at start',legal(b,'w').length,44);
eq('engine perft 1..3',[1,2,3].map(d=>perft(b,'w',d)),[44,1920,79666]);
eq('fen roundtrip',toFen(b,'w'),START);
// perpetual check: a rook that checks every move while the king just steps aside loses on the 3rd repetition
let st=parse('3k5/9/9/9/9/4R4/9/9/9/5K3 w'),bb=st.b,turn='w';const tl=[{b:bb,turn,cap:false}];
for(let i=0;i<2;i++)for(const m of[[49,48],[3,4],[48,49],[4,3]]){bb=apply(bb,m);turn=turn==='w'?'b':'w';tl.push({b:bb,turn,cap:false})}
eq('perpetual check loses',outcome(tl)?.winner,'b');
const r=think({b,turn:'w',timeline:[{b,turn:'w'}],level:3});console.log('engine Hard: depth',r.depth,'in',r.ms,'ms, move',r.move);
eq('engine returns a legal move',legal(b,'w').some(m=>m[0]===r.move[0]&&m[1]===r.move[1]),true);
if(fail){console.log(fail,'test(s) failed');process.exit(1)}console.log('all tests passed');
