// Thin UCI client for Stockfish (WASM, runs in a Web Worker started from /stockfish/). One search at a time.
export const CHESS_LEVELS=[
  {name:'Beginner',skill:0,ms:40},
  {name:'Easy (~1320)',elo:1320,ms:150},
  {name:'Medium (~1700)',elo:1700,ms:300},
  {name:'Hard (~2100)',elo:2100,ms:600},
  {name:'Expert (~2700)',elo:2700,ms:1200},
  {name:'Master (full strength)',ms:2500}];
const URL_='/stockfish/stockfish-19-lite-single.js';
export class Stockfish{
  constructor(){this.w=null;this.ready=null;this.cur=null;this.latest=null;this.pending=null}
  start(){if(this.ready)return this.ready;
    this.ready=new Promise((res,rej)=>{let w;try{w=new Worker(URL_)}catch(e){return rej(e)}this.w=w;let st='uci';
      w.onerror=e=>rej(new Error('engine failed to load'));
      w.onmessage=e=>{const l=String(e.data);
        if(st==='uci'){if(l.includes('uciok')){st='ready';w.postMessage('isready')}}
        else if(st==='ready'){if(l.includes('readyok')){st='run';res()}}
        else this.line(l)};
      w.postMessage('uci')});
    return this.ready}
  line(l){if(l.startsWith('info')&&this.cur){const m=/score (cp|mate) (-?\d+)/.exec(l),d=/ depth (\d+)/.exec(l);if(m)this.cur.score={type:m[1],v:+m[2]};if(d)this.cur.depth=+d[1]}
    else if(l.startsWith('bestmove')&&this.cur){const r=this.cur;this.cur=null;const mv=l.split(' ')[1];r.res({move:mv&&mv!=='(none)'?mv:null,score:r.score,depth:r.depth,stale:r.stale});this.next()}}
  next(){if(this.cur||!this.pending)return;const r=this.pending;this.pending=null;this.run(r)}
  run(r){this.cur=r;const w=this.w,L=r.level;
    w.postMessage('setoption name UCI_LimitStrength value '+(L.elo?'true':'false'));if(L.elo)w.postMessage('setoption name UCI_Elo value '+L.elo);
    w.postMessage('setoption name Skill Level value '+(L.skill??20));
    w.postMessage('position fen '+r.fen);w.postMessage('go movetime '+L.ms)}
  // resolves {move:'e2e4'|null,score,depth,stale}; a newer request or cancel() marks the older one stale (also if it has not started yet)
  best(fen,level){return new Promise((res,rej)=>{const r={fen,level,res};this.latest=r;
    this.start().then(()=>{if(this.latest!==r){res({move:null,stale:true});return}
      if(this.pending)this.pending.res({move:null,stale:true});
      if(this.cur){this.cur.stale=true;this.pending=r;this.w.postMessage('stop')}else this.run(r)},rej)})}
  cancel(){this.latest=null;if(this.pending){this.pending.res({move:null,stale:true});this.pending=null}if(this.cur){this.cur.stale=true;this.w.postMessage('stop')}}
  terminate(){this.cancel();this.w&&this.w.terminate();this.w=null;this.ready=null}
}
