// Chess: rules come from chess.js; this tests our glue (engine client, supersede/stale logic, level table) with the real Stockfish run in Node.
import {createRequire} from 'node:module';
import {Chess} from 'chess.js';
const require=createRequire(import.meta.url);
globalThis.Worker=class{constructor(){const sf=require('stockfish')('lite-single',l=>{for(const x of String(l).split(/(?=uciok|readyok|bestmove|info )/))this.onmessage&&this.onmessage({data:x})});this.sf=sf}postMessage(m){this.sf.processCommand(m)}terminate(){this.sf.terminate()}};
const {Stockfish,CHESS_LEVELS}=await import('./stockfishClient.js');
let bad=0;const eq=(n,g,e)=>{const ok=JSON.stringify(g)===JSON.stringify(e);if(!ok)bad++;console.log(ok?'ok  ':'FAIL',n,ok?'':`got ${JSON.stringify(g)} want ${JSON.stringify(e)}`)};
const START='rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const sf=new Stockfish();
const legalUci=(fen,u)=>new Chess(fen).moves({verbose:true}).some(m=>m.from+m.to+(m.promotion||'')===u);
for(const lv of[0,2,5]){const r=await sf.best(START,CHESS_LEVELS[lv]);eq(`level ${lv} (${CHESS_LEVELS[lv].name}) returns a legal move`,legalUci(START,r.move),true)}
// finds mate in one: Qh5# style position (back-rank): white Ra1, black king g8 with pawns f7 g7 h7
const MATE='6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1',r1=await sf.best(MATE,CHESS_LEVELS[5]);eq('Master finds the back-rank mate',r1.move,'a1a8');
// promotion move is reported with its piece letter
const r2=await sf.best('8/P6k/8/8/8/8/8/K7 w - - 0 1',CHESS_LEVELS[5]);eq('engine promotes with a letter',/^a7a8[qrbn]$/.test(r2.move),true);
// a newer request makes the older one stale, and the newer still answers
const pa=sf.best(START,CHESS_LEVELS[5]),pb=sf.best('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',CHESS_LEVELS[1]);
const [ra,rb]=await Promise.all([pa,pb]);eq('older search is marked stale',!!ra.stale||ra.move===null,true);eq('newer search still answers legally',legalUci('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',rb.move),true);
// cancel
const pc=sf.best(START,CHESS_LEVELS[5]);sf.cancel();const rc=await pc;eq('cancel marks the search stale',!!rc.stale,true);
// the client keeps working after cancel
const rd=await sf.best(START,CHESS_LEVELS[1]);eq('works again after cancel',legalUci(START,rd.move),true);
// glue: replay SAN history, promotion/castling/en passant are handled by chess.js
{const c=new Chess();for(const s of['e4','e5','Nf3','Nc6','Bb5','a6','Ba4','Nf6','O-O'])c.move(s);eq('castling replays',c.fen().split(' ')[0],'r1bqkb1r/1ppp1ppp/p1n2n2/4p3/B3P3/5N2/PPPP1PPP/RNBQ1RK1');}
{const c=new Chess('rnbqkbnr/ppp1pppp/8/8/3pP3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1');eq('en passant is legal',c.moves().includes('dxe3'),true)}
{const c=new Chess('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1');eq('stalemate detected',c.isStalemate(),true)}
sf.terminate();console.log(bad?bad+' FAILED':'all chess tests passed');process.exit(bad?1:0)
