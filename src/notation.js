import {apply,inCheck,legal,toFen} from './xq.js';
// Coordinate notation: files a-i (left to right as seen from Red), ranks 0-9 counted from Red's back rank.
// e.g. "Ch2-e2" = cannon from h2 to e2; x = capture, + = check, # = no legal reply.
export const LEGEND='Pieces: K general, A advisor, B elephant, N horse, R rook, C cannon, P soldier. Squares: files a-i left to right (Red side), ranks 0-9 from Red\'s back rank. x = capture, + = check, # = mate.';
const sq=i=>'abcdefghi'[i%9]+(9-((i/9)|0)),cache=new Map();
export function moveText(b,m,turn){const key=toFen(b,turn)+m.join(),hit=cache.get(key);if(hit)return hit;
  const p=b[m[0]],nb=apply(b,m),opp=turn==='w'?'b':'w';
  let s=p.toUpperCase()+sq(m[0])+(b[m[1]]?'x':'-')+sq(m[1]);
  const moves=legal(nb,opp).length;if(inCheck(nb,opp))s+=moves?'+':'#';else if(!moves)s+='#';
  if(cache.size>5000)cache.clear();cache.set(key,s);return s}
// states = [{b,turn,last}] oldest..current -> list of move texts (states[k].last is the move that led to states[k])
export const notes=states=>states.slice(1).map((s,k)=>s.last?moveText(states[k].b,s.last,states[k].turn):'?');
export function gameText(states,result,date){const first=states[0].turn,n=notes(states),out=[];let no=1;
  n.forEach((t,i)=>{const mover=i%2===0?first:first==='w'?'b':'w';
    if(mover==='w')out.push(`${no}. ${t}`);else{if(!out.length||i===0)out.push(`${no}... ${t}`);else out[out.length-1]+=` ${t}`;no++}});
  return[`[Event "Xiangqi web app"]`,`[Date "${date}"]`,`[FEN "${toFen(states[0].b,first)}"]`,`[Result "${result}"]`,`[Notation "coordinate"]`,'',out.join('\n'),'','; '+LEGEND].join('\n')}
