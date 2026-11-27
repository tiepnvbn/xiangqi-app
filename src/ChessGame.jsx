import {useEffect,useMemo,useRef,useState} from 'react';
import {Chess} from 'chess.js';
import {Stockfish,CHESS_LEVELS} from './stockfishClient.js';
const GLYPH={k:'♚',q:'♛',r:'♜',b:'♝',n:'♞',p:'♟'};
const FILES='abcdefgh',START_FEN='rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const ld=(k,d)=>{try{const v=localStorage.getItem('chess_'+k);return v===null?d:JSON.parse(v)}catch(e){return d}};
const sv=(k,v)=>{try{localStorage.setItem('chess_'+k,JSON.stringify(v))}catch(e){}};
const sqXY=(sq,fl)=>{const c=FILES.indexOf(sq[0]),r=8-+sq[1];return[(fl?7-c:c)*50+25,(fl?7-r:r)*50+25]};
export default function ChessGame({onHome}){
  const [startFen,setStartFen]=useState(START_FEN),[hist,setHist]=useState([]);        // hist = list of SAN strings played from startFen
  const [vs,setVs]=useState(()=>ld('vs','ai')),[lv,setLv]=useState(()=>Math.min(CHESS_LEVELS.length-1,Math.max(0,ld('lv',2)))),[human,setHuman]=useState('w'),[flip,setFlip]=useState(false);
  const [sel,setSel]=useState(null),[promo,setPromo]=useState(null),[view,setView]=useState(null),[busy,setBusy]=useState(false),[note,setNote]=useState(''),[msg,setMsg]=useState(''),[fenIn,setFenIn]=useState(''),[engine,setEngine]=useState('idle');
  const sf=useRef(null),histRef=useRef(null);
  // positions after every ply (index 0 = start), plus verbose move info
  const {fens,moves,game}=useMemo(()=>{const c=new Chess(startFen),fens=[c.fen()],moves=[];for(const san of hist){const m=c.move(san);moves.push(m);fens.push(c.fen())}return{fens,moves,game:c}},[startFen,hist]);
  const n=hist.length,cur=view??n,shown=useMemo(()=>view===null?game:new Chess(fens[view]),[view,game,fens]);
  const turn=game.turn(),ai=vs==='ai',lastMove=cur>0?moves[cur-1]:null;
  const over=game.isGameOver(),inChk=shown.inCheck();
  const fl=flip!==(ai&&human==='b');
  const board=shown.board(),legal=useMemo(()=>sel&&view===null?game.moves({square:sel,verbose:true}):[],[sel,game,view]);
  useEffect(()=>()=>{sf.current&&sf.current.terminate()},[]);
  const reset=(fen=START_FEN)=>{sf.current&&sf.current.cancel();setStartFen(fen);setHist([]);setSel(null);setPromo(null);setView(null);setNote('');setMsg('');setBusy(false)};
  const play=mv=>{try{const c=new Chess(fens[n]);const m=c.move(mv);if(!m)return;setHist(h=>[...h,m.san]);setSel(null);setPromo(null);setNote('')}catch(e){}};
  // engine reply
  useEffect(()=>{
    if(!ai||over||turn===human||view!==null)return;let dead=false;setBusy(true);
    sf.current??=new Stockfish();setEngine(e=>e==='ready'?e:'loading');
    const fen=game.fen();
    sf.current.best(fen,CHESS_LEVELS[lv]).then(r=>{if(dead||r.stale)return;setEngine('ready');setBusy(false);
      if(r.move){play({from:r.move.slice(0,2),to:r.move.slice(2,4),promotion:r.move[4]});
        if(r.depth)setNote(`Engine: depth ${r.depth}`+(r.score?`, eval ${r.score.type==='mate'?'mate in '+Math.abs(r.score.v):((turn==='w'?r.score.v:-r.score.v)/100).toFixed(2)} (White's view)`:''))}
    }).catch(e=>{if(dead)return;setEngine('error');setBusy(false);setMsg('The engine could not be loaded ('+e.message+'). You can still play 2 players.')});
    return()=>{dead=true;sf.current&&sf.current.cancel();setBusy(false)};
  },[hist,startFen,ai,human,lv,over,view]);
  useEffect(()=>{const el=histRef.current;if(el&&view===null)el.scrollTop=el.scrollHeight},[n,view]);
  useEffect(()=>{const h=e=>{if(/INPUT|SELECT|TEXTAREA/.test(e.target.tagName))return;if(e.key==='ArrowLeft'){e.preventDefault();goto(cur-1)}else if(e.key==='ArrowRight'){e.preventDefault();goto(cur+1)}};window.addEventListener('keydown',h);return()=>window.removeEventListener('keydown',h)});
  const goto=k=>{k=Math.max(0,Math.min(n,k));setView(k===n?null:k);setSel(null);setPromo(null)};
  const click=sq=>{
    if(view!==null){setNote('Reviewing an earlier position. Press "Back to game" to continue.');return}
    if(over||busy||(ai&&turn!==human))return;
    const mv=legal.filter(m=>m.to===sq);
    if(mv.length){if(mv[0].promotion){setPromo({from:sel,to:sq});return}return play({from:sel,to:sq})}
    const p=game.get(sq);if(p&&p.color===turn){setSel(sq);setNote(game.moves({square:sq}).length?'':'This piece has no legal moves.')}else{setSel(null);setNote('')}};
  const undo=()=>{if(!n)return;const k=ai&&turn===human?2:1;sf.current&&sf.current.cancel();setHist(h=>h.slice(0,Math.max(0,h.length-k)));setSel(null);setView(null);setNote('')};
  const playFrom=()=>{if(view===null)return;setHist(h=>h.slice(0,view));setView(null)};
  const loadFen=()=>{try{const c=new Chess(fenIn.trim());reset(c.fen())}catch(e){setMsg('Invalid FEN')}};
  const pgn=()=>{const c=new Chess(startFen);hist.forEach(s=>c.move(s));return c.pgn()};
  const copy=async()=>{try{await navigator.clipboard.writeText(pgn());setMsg('PGN copied.')}catch(e){setMsg('Could not copy; use Download instead.')}};
  const download=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([pgn()],{type:'text/plain'}));a.download='chess-game.pgn';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000)};
  const name=c=>c==='w'?'White':'Black',who=c=>!ai?name(c):c===human?`You (${name(c)})`:`Engine (${name(c)})`;
  let status;
  if(game.isCheckmate())status=`Checkmate! ${name(turn==='w'?'b':'w')} wins`;
  else if(game.isStalemate())status='Draw: stalemate';else if(game.isThreefoldRepetition())status='Draw: the same position occurred 3 times';
  else if(game.isInsufficientMaterial())status='Draw: insufficient material';else if(game.isDraw())status='Draw: 50 moves without a capture or pawn move';
  else status=`${who(turn)} to move`+(busy?(engine==='loading'?' (loading engine…)':' (thinking…)'):'');
  const kingSq=inChk?(()=>{for(const row of board)for(const p of row)if(p&&p.type==='k'&&p.color===shown.turn())return p.square})():null;
  const caps=useMemo(()=>{const cnt={w:{p:8,n:2,b:2,r:2,q:1},b:{p:8,n:2,b:2,r:2,q:1}};for(const row of shown.board())for(const p of row)if(p&&p.type!=='k')cnt[p.color][p.type]--;return cnt},[shown]);
  const lost=c=>Object.entries(caps[c]).flatMap(([t,k])=>k>0?Array(k).fill(GLYPH[t]):[]).join('');
  const sq=[];for(let r=0;r<8;r++)for(let c=0;c<8;c++){const f=fl?7-c:c,rk=fl?7-r:r,name=FILES[f]+(8-rk);sq.push({name,x:c*50,y:r*50,dark:(f+rk)%2===1})}
  const mvRows=[];for(let i=0;i<hist.length;i+=2)mvRows.push([i,hist[i],hist[i+1]]);
  const startTurn=new Chess(startFen).turn()==='b'?1:0;   // black to move in a loaded FEN: first SAN belongs to Black
  return <div className="wrap"><div className="boardbox sq">
    <svg className="board" viewBox="0 0 400 400" style={{background:'#b58863'}}>
      {sq.map(s=><rect key={s.name} x={s.x} y={s.y} width="50" height="50" fill={s.dark?'#b58863':'#f0d9b5'} onClick={()=>click(s.name)}/>)}
      {lastMove&&[lastMove.from,lastMove.to].map(q=>{const[x,y]=sqXY(q,fl);return <rect key={'l'+q} x={x-25} y={y-25} width="50" height="50" fill="rgba(255,214,0,.45)" pointerEvents="none"/>})}
      {kingSq&&(()=>{const[x,y]=sqXY(kingSq,fl);return <circle cx={x} cy={y} r="24" fill="rgba(229,57,53,.5)" stroke="#e53935" strokeWidth="3" pointerEvents="none"><animate attributeName="r" values="21;26;21" dur="0.9s" repeatCount="indefinite"/></circle>})()}
      {sel&&view===null&&(()=>{const[x,y]=sqXY(sel,fl);return <rect x={x-25} y={y-25} width="50" height="50" fill="rgba(40,170,110,.45)" pointerEvents="none"/>})()}
      {board.flat().filter(Boolean).map(p=>{const[x,y]=sqXY(p.square,fl),w=p.color==='w';return <text key={p.square} x={x} y={y+14} textAnchor="middle" fontSize="42" pointerEvents="none"
        fontFamily="'Segoe UI Symbol','Noto Sans Symbols 2','Apple Symbols','DejaVu Sans',serif" fill={w?'#fff':'#1a1a1a'} stroke={w?'#222':'#ddd'} strokeWidth={w?1.4:.6} paintOrder="stroke">{GLYPH[p.type]+'︎'}</text>})}
      {legal.map(m=>{const[x,y]=sqXY(m.to,fl),cap=!!game.get(m.to)||m.flags.includes('e');return cap?<circle key={m.to} cx={x} cy={y} r="22" fill="none" stroke="rgba(40,170,110,.8)" strokeWidth="4" pointerEvents="none"/>:<circle key={m.to} cx={x} cy={y} r="8" fill="rgba(40,170,110,.75)" pointerEvents="none"/>})}
      {[0,1,2,3,4,5,6,7].map(i=><g key={i} fontSize="10" fontWeight="700" pointerEvents="none"><text x="2" y={i*50+11} fill={(i+(fl?1:0))%2===0?'#b58863':'#f0d9b5'}>{fl?i+1:8-i}</text><text x={i*50+41} y="397" fill={(i+(fl?0:1))%2===0?'#b58863':'#f0d9b5'}>{FILES[fl?7-i:i]}</text></g>)}
      {promo&&<g><rect width="400" height="400" fill="rgba(0,0,0,.5)"/><rect x="60" y="150" width="280" height="100" rx="10" fill="#2d2924" stroke="#a33" strokeWidth="2"/>
        {['q','r','b','n'].map((t,i)=><g key={t} onClick={()=>play({from:promo.from,to:promo.to,promotion:t})} style={{cursor:'pointer'}}><rect x={70+i*65} y={165} width="60" height="70" rx="8" fill="#3d372f"/>
          <text x={100+i*65} y={217} textAnchor="middle" fontSize="48" fontFamily="'Segoe UI Symbol','Noto Sans Symbols 2','Apple Symbols','DejaVu Sans',serif" fill={turn==='w'?'#fff':'#1a1a1a'} stroke={turn==='w'?'#222':'#ddd'} strokeWidth="1" paintOrder="stroke">{GLYPH[t]+'︎'}</text></g>)}</g>}
    </svg></div>
    <div className="panel">
      <div className="row"><button onClick={onHome}>← All games</button></div>
      <h2 style={{margin:0}}>Cờ Vua · Chess</h2><div className="msg">{status}</div>
      {view!==null&&<div className="note">Reviewing move {view} of {n}. Arrow keys ◀ ▶ step through the game.</div>}
      {inChk&&!game.isCheckmate()&&<div className="warn">⚠ {name(shown.turn())} king is in check!</div>}
      {note&&<div className="note">{note}</div>}{msg&&<div className="msg">{msg}</div>}
      {startFen===START_FEN&&<div className="note" style={{color:'#bbb'}}>Captured by Black: {lost('w')||'–'} · by White: {lost('b')||'–'}</div>}
      <div className="row"><button className={ai?'on':''} onClick={()=>{setVs('ai');sv('vs','ai');reset(startFen)}}>vs Engine</button><button className={!ai?'on':''} onClick={()=>{setVs('two');sv('vs','two');reset(startFen)}}>2 players</button></div>
      {ai&&<div className="row"><select value={lv} onChange={e=>{setLv(+e.target.value);sv('lv',+e.target.value)}}>{CHESS_LEVELS.map((l,i)=><option key={i} value={i}>{l.name}</option>)}</select>
        <select value={human} onChange={e=>{setHuman(e.target.value);reset(startFen)}}><option value="w">You: White</option><option value="b">You: Black</option></select></div>}
      <div className="row"><button onClick={undo} disabled={!n}>Undo</button><button onClick={()=>setFlip(f=>!f)}>Flip board</button><button onClick={()=>reset()}>New game</button></div>
      <div className="hist" ref={histRef}>{!n&&<span className="note">No moves yet</span>}
        {mvRows.map(([i,a,b])=><span key={i}><span className="no">{Math.floor((i+startTurn)/2)+1}{startTurn&&i===0?'…':'.'}</span><button className={'mv'+(cur===i+1?' cur':'')} onClick={()=>goto(i+1)}>{a}</button>{b&&<button className={'mv'+(cur===i+2?' cur':'')} onClick={()=>goto(i+2)}>{b}</button>}</span>)}</div>
      <div className="row"><button onClick={()=>goto(0)}>⏮</button><button onClick={()=>goto(cur-1)}>◀</button><button onClick={()=>goto(cur+1)}>▶</button><button onClick={()=>goto(n)}>⏭</button>{view!==null&&<button onClick={()=>setView(null)}>Back to game</button>}</div>
      {view!==null&&<div className="row"><button onClick={playFrom}>Play from this position</button></div>}
      <div className="row"><button onClick={copy} disabled={!n}>Copy PGN</button><button onClick={download} disabled={!n}>Download PGN</button></div>
      <div className="row"><input value={fenIn} onChange={e=>setFenIn(e.target.value)} placeholder="FEN"/><button onClick={loadFen}>Load</button><button onClick={()=>setFenIn(game.fen())}>Get</button></div>
    </div></div>}
