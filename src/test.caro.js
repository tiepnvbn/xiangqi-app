import {winAt,newBoard,result} from './caro.js';
import {thinkCaro} from './caroAI.js';
let bad=0;const eq=(n,g,e)=>{const ok=JSON.stringify(g)===JSON.stringify(e);if(!ok)bad++;console.log(ok?'ok  ':'FAIL',n,ok?'':`got ${JSON.stringify(g)} want ${JSON.stringify(e)}`)};
const N=15,at=(r,c)=>r*N+c,mk=(arr)=>{const b=newBoard(N);for(const[r,c,p]of arr)b[at(r,c)]=p;return b};
// rules
eq('4 in a row is not a win',!!winAt(mk([[7,3,1],[7,4,1],[7,5,1],[7,6,1]]),N,at(7,6)),false);
eq('5 horizontal wins',winAt(mk([[7,3,1],[7,4,1],[7,5,1],[7,6,1],[7,7,1]]),N,at(7,5)).length,5);
eq('5 vertical wins (middle stone last)',!!winAt(mk([[3,2,2],[4,2,2],[5,2,2],[6,2,2],[7,2,2]]),N,at(5,2)),true);
eq('5 diagonal / wins',!!winAt(mk([[3,7,1],[4,6,1],[5,5,1],[6,4,1],[7,3,1]]),N,at(7,3)),true);
eq('5 diagonal \\ wins',!!winAt(mk([[3,3,2],[4,4,2],[5,5,2],[6,6,2],[7,7,2]]),N,at(3,3)),true);
eq('6 in a row also wins (free rule)',winAt(mk([[7,2,1],[7,3,1],[7,4,1],[7,5,1],[7,6,1],[7,7,1]]),N,at(7,4)).length,6);
eq('five split by an enemy stone is no win',!!winAt(mk([[7,2,1],[7,3,1],[7,4,2],[7,5,1],[7,6,1]]),N,at(7,6)),false);
const blocked=mk([[7,2,2],[7,3,1],[7,4,1],[7,5,1],[7,6,1],[7,7,1],[7,8,2]]);
eq('five blocked on both ends: wins under free rule',!!winAt(blocked,N,at(7,5),'free'),true);
eq('five blocked on both ends: no win under VN rule',!!winAt(blocked,N,at(7,5),'vn'),false);
eq('five with one open end wins under VN rule',!!winAt(mk([[7,2,2],[7,3,1],[7,4,1],[7,5,1],[7,6,1],[7,7,1]]),N,at(7,5),'vn'),true);
eq('five at the board edge is not "blocked"',!!winAt(mk([[7,0,1],[7,1,1],[7,2,1],[7,3,1],[7,4,1],[7,5,2]]),N,at(7,2),'vn'),true);
{const mv=[];for(let k=0;k<5;k++){mv.push({i:at(3,k),p:1});if(k<4)mv.push({i:at(9,k),p:2})}eq('result: X wins with 5',result(mv,N).winner,1)}
// AI tactics (every level except the deliberately sloppy Beginner must see these)
const ai=(b,p,level,rule)=>thinkCaro({board:b,N,player:p,level,rule}).move;
for(const lv of[1,2,3]){
  eq(`L${lv} completes its own five`,[at(7,2),at(7,7)].includes(ai(mk([[7,3,1],[7,4,1],[7,5,1],[7,6,1],[2,2,2],[2,3,2],[2,4,2]]),1,lv)),true);
  eq(`L${lv} blocks a four`,[at(7,2),at(7,7)].includes(ai(mk([[7,3,2],[7,4,2],[7,5,2],[7,6,2],[2,2,1],[10,10,1],[2,9,1]]),1,lv)),true);
  eq(`L${lv} prefers winning to blocking`,[at(2,6),at(2,1)].includes(ai(mk([[2,2,1],[2,3,1],[2,4,1],[2,5,1],[7,3,2],[7,4,2],[7,5,2],[7,6,2]]),1,lv)),true)}
for(const lv of[2,3,4]){
  eq(`L${lv} blocks an open three (cannot be stopped later)`,[at(7,2),at(7,6)].includes(ai(mk([[7,3,2],[7,4,2],[7,5,2],[3,3,1],[11,11,1]]),1,lv)),true)}
eq('L2 turns an open three into an open four',[at(7,2),at(7,6)].includes(ai(mk([[7,3,1],[7,4,1],[7,5,1],[3,9,2],[12,2,2]]),1,2)),true);
eq('first move is the centre',ai(newBoard(N),1,3),at(7,7));
// strength: Hard vs Beginner/Easy over a few games, and speed
function game(l1,l2,rule){const mv=[],b=newBoard(N);let p=1;const lv={1:l1,2:l2};
  for(let n=0;n<N*N;n++){const r=thinkCaro({board:b,N,player:p,level:lv[p],rule});if(!r)return 0;if(b[r.move])throw new Error('occupied');b[r.move]=p;if(winAt(b,N,r.move,rule))return p;p=3-p}return 0}
let w=0,l=0,d=0,t0=Date.now();for(let g=0;g<6;g++){const hardIsX=g%2===0,res=game(hardIsX?2:0,hardIsX?0:2,'free');if(!res)d++;else if((res===1)===hardIsX)w++;else l++}
eq(`Medium vs Beginner (6 games): wins ${w}, losses ${l}, draws ${d}`,w>=5&&l===0,true);
w=l=d=0;for(let g=0;g<4;g++){const hX=g%2===0,res=game(hX?3:1,hX?1:3,'free');if(!res)d++;else if((res===1)===hX)w++;else l++}
eq(`Hard vs Easy (4 games): wins ${w}, losses ${l}, draws ${d}`,w>=3&&l===0,true);
console.log('games took',((Date.now()-t0)/1000).toFixed(1),'s');
console.log(bad?bad+' FAILED':'all caro tests passed');process.exit(bad?1:0)
