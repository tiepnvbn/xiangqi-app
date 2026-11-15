import {useEffect,useMemo,useRef,useState} from 'react';
import {START,parse,parseLoose,toFen,legal,apply,inCheck,red,pseudo,checkers,kingOf,outcome} from './xq.js';
import {detect,finishCore,recognize,decodeTemplates} from './vision.js';
import TPL from './templates.json';
const TP=decodeTemplates(TPL);
const GR={r:'車',n:'馬',b:'相',a:'仕',k:'帥',c:'炮',p:'兵'},GB={r:'車',n:'馬',b:'象',a:'士',k:'將',c:'砲',p:'卒'};
const glyph=p=>(red(p)?GR:GB)[p.toLowerCase()];
const LEVELS=['Beginner','Easy','Medium','Hard','Expert (~4s)','Master (~10s)'];
const X=c=>30+c*50,Y=r=>30+r*50,PIECES='KABNRCPkabnrcp'.split('');
export default function App(){
  const [b,setB]=useState(parse(START).b),[turn,setTurn]=useState('w'),[hist,setHist]=useState([]);
  const [sel,setSel]=useState(null),[mode,setMode]=useState('play'),[lv,setLv]=useState(3),[human,setHuman]=useState('w');
  const [flags,setFlags]=useState([]),[hasDet,setHasDet]=useState(false),[last,setLast]=useState(null),[cap,setCap]=useState(false),[note,setNote]=useState(''),[busy,setBusy]=useState(false),[pal,setPal]=useState('P'),[fen,setFen]=useState(''),[msg,setMsg]=useState('');
  const wk=useRef(),job=useRef(0),detRef=useRef(null);
  const ms=useMemo(()=>mode==='play'?legal(b,turn):[],[b,turn,mode]);
  const tl=useMemo(()=>[...hist.map(h=>({b:h.b,turn:h.turn,cap:h.cap})),{b,turn,cap}],[hist,b,turn,cap]);
  const res=useMemo(()=>mode==='play'&&ms.length?outcome(tl):null,[tl,mode,ms]);
  const noMoves=mode==='play'&&!ms.length,over=noMoves||!!res;
  const chk=mode==='play'&&inCheck(b,turn),atk=chk?checkers(b,turn):[],kingIdx=chk?kingOf(b,turn):-1;
  const move=m=>{setHist(h=>[...h,{b,turn,last,cap}]);setCap(!!b[m[1]]);setLast(m);setB(apply(b,m));setTurn(turn==='w'?'b':'w');setSel(null);setNote('')};
  useEffect(()=>{
    if(mode!=='play'||over||turn===human)return;
    wk.current??=new Worker(new URL('./engine.worker.js',import.meta.url),{type:'module'});
    const id=++job.current,w=wk.current;setBusy(true);
    w.onmessage=e=>{if(e.data.id!==job.current)return;setBusy(false);if(e.data.move){move(e.data.move);if(e.data.info&&e.data.info.depth)setNote(`Engine searched ${e.data.info.depth} moves deep in ${(e.data.info.ms/1000).toFixed(1)}s`)}};
    w.postMessage({id,b,turn,timeline:tl.map(x=>({b:x.b,turn:x.turn})),level:lv});
    return()=>{job.current++;setBusy(false)};
  },[b,turn,mode,human,lv,over]);
  const click=i=>{
    if(mode==='edit'){setFlags(f=>f.filter(x=>x!==i));const n=b.slice();n[i]=pal==='x'?'':pal;setB(n);return}
    if(over||busy||turn!==human)return;
    const mine=b[i]&&red(b[i])===(turn==='w');
    if(sel!==null&&ms.some(m=>m[0]===sel&&m[1]===i))return move([sel,i]);
    if(mine){setSel(i);setNote(ms.some(m=>m[0]===i)?'':chk?'This piece cannot get your general out of check.':'This piece has no legal moves (moving it would expose your general, or it is blocked).');return}
    if(sel!==null&&pseudo(b,turn).some(m=>m[0]===sel&&m[1]===i))setNote(chk?'Your general is in check! You must capture the attacker, block the attack, or move the general.':'Illegal: that move would leave your general under attack (or facing the enemy general).');
    else{setNote('');setSel(null)}
  };
  const load=f=>{const p=parse(f);if(!p)return setMsg('Invalid FEN');setB(p.b);setTurn(p.turn);setHist([]);setSel(null);setLast(null);setCap(false);setNote('');setMsg('')};
  const undo=()=>{if(!hist.length)return;const k=turn===human&&hist.length>1?2:1,h=hist[hist.length-k];setB(h.b);setTurn(h.turn);setLast(h.last);setCap(h.cap);setHist(hist.slice(0,-k));setSel(null);setNote('')};
  const play=()=>{setFlags([]);if(!b.includes('K')||!b.includes('k'))return setMsg('Both generals are required.');setMsg('');setHist([]);setSel(null);setLast(null);setCap(false);setNote('');setMode('play')};
  async function scan(file){if(!file)return;setMsg('Detecting pieces…');setFlags([]);
    const t0=performance.now();let d=null,loc=null;
    try{d=await detect(file);if(d)loc=recognize(d,TP)}catch(e){}
    detRef.current=d;setHasDet(!!d);const secs=((performance.now()-t0)/1000).toFixed(1);
    if(loc&&loc.bad===0){setB(loc.board);setTurn('w');setFlags(loc.unsure);setMode('edit');
      setMsg(`Recognised ${d.P.length} pieces on this device in ${secs}s.`+(loc.unsure.length?' Orange rings = please double-check.':'')+(loc.flipped?' (Board was rotated; shown with Red at the bottom.)':'')+' Fix any mistakes, then press Play.');return}
    setMsg(`Could not read the board on this device (${secs}s). Trying AI scan, up to ~30s…`);return fullScan(file)}
  async function aiReread(){const d=detRef.current;if(!d)return;setMsg('Asking Gemini to read the pieces (up to ~30s)…');
    try{const r=await fetch('/api/scan',{method:'POST',signal:AbortSignal.timeout(35000),headers:{'content-type':'application/json'},body:JSON.stringify({image:d.makeSheet(),mode:'tiles',n:d.P.length})});
      const j=await r.json(),f=r.ok&&finishCore(d,j.chars);if(!f)throw new Error(j.error||'could not read the pieces');
      setB(f.board);setTurn('w');setFlags([]);setMsg('Re-read by AI. Check the board, then press Play.'+(f.warn?` ${f.warn} piece(s) could not be read.`:''))
    }catch(e){setMsg('AI re-read failed: '+(e.name==='TimeoutError'?'timed out':e.message))}}
  async function fullScan(file){
    try{const img=await createImageBitmap(file),s=Math.min(1,1024/Math.max(img.width,img.height)),c=document.createElement('canvas');
      c.width=img.width*s;c.height=img.height*s;c.getContext('2d').drawImage(img,0,0,c.width,c.height);
      const r=await fetch('/api/scan',{method:'POST',signal:AbortSignal.timeout(40000),headers:{'content-type':'application/json'},body:JSON.stringify({image:c.toDataURL('image/jpeg',.85).split(',')[1]})});
      const j=await r.json(),p=j.fen&&parseLoose(j.fen);if(!p)throw new Error(j.error||'no FEN');
      setB(p.b);setTurn(p.turn);setMode('edit');setMsg(p.fixed?'Scanned, but some rows looked wrong and were repaired. Check the board carefully, fix mistakes, then press Play.':'Scanned. Fix any mistakes, then press Play.');
    }catch(e){setMsg('Scan failed: '+(e.name==='TimeoutError'?'timed out, please try again':e.message))}}
  const shift=(dr,dc)=>{const n=Array(90).fill('');for(let i=0;i<90;i++)if(b[i]){const r=(i/9|0)+dr,c=i%9+dc;if(r<0||r>9||c<0||c>8)return setMsg('Cannot shift further');n[r*9+c]=b[i]}setB(n)};
  const targets=sel!==null?ms.filter(m=>m[0]===sel).map(m=>m[1]):[];
  const who=turn==='w'?'Red':'Black',other=turn==='w'?'Black':'Red';
  const status=mode==='edit'?'Edit mode':noMoves?(chk?`Checkmate! ${other} wins`:`${who} has no legal moves: ${other} wins`):res?res.text:`${who} to move`+(busy?' (thinking…)':'');
  const lines=[];for(let r=0;r<10;r++)lines.push([X(0),Y(r),X(8),Y(r)]);
  for(let c=0;c<9;c++){if(c===0||c===8)lines.push([X(c),Y(0),X(c),Y(9)]);else lines.push([X(c),Y(0),X(c),Y(4)],[X(c),Y(5),X(c),Y(9)])}
  [[3,0,5,2],[5,0,3,2],[3,7,5,9],[5,7,3,9]].forEach(([a,r,c,s])=>lines.push([X(a),Y(r),X(c),Y(s)]));
  return <div className="wrap">
    <svg viewBox="0 0 460 510" width="460">
      {lines.map((l,i)=><line key={i} x1={l[0]} y1={l[1]} x2={l[2]} y2={l[3]} stroke="#5a3a1a" strokeWidth="1.5"/>)}
      <text x="130" y="285" fontSize="24" fill="#5a3a1a">楚 河</text><text x="270" y="285" fontSize="24" fill="#5a3a1a">漢 界</text>
      {last&&<><circle cx={X(last[0]%9)} cy={Y(last[0]/9|0)} r="22" fill="none" stroke="#c9a000" strokeWidth="3" strokeDasharray="5 4"/>
        <circle cx={X(last[1]%9)} cy={Y(last[1]/9|0)} r="27" fill="rgba(255,214,0,.35)" stroke="#e6b800" strokeWidth="3"/></>}
      {atk.map(i=><circle key={'a'+i} cx={X(i%9)} cy={Y(i/9|0)} r="26" fill="none" stroke="#e53935" strokeWidth="3" strokeDasharray="4 3"/>)}
      {kingIdx>=0&&<circle cx={X(kingIdx%9)} cy={Y(kingIdx/9|0)} r="26" fill="rgba(229,57,53,.35)" stroke="#e53935" strokeWidth="4"><animate attributeName="r" values="24;31;24" dur="0.9s" repeatCount="indefinite"/></circle>}
      {b.map((p,i)=>{const r=i/9|0,c=i%9;return <g key={i} onClick={()=>click(i)} style={{cursor:'pointer'}}>
        <circle cx={X(c)} cy={Y(r)} r="23" fill="transparent"/>
        {p&&<><circle cx={X(c)} cy={Y(r)} r="21" fill="#f6e3b4" stroke={sel===i?'#2a7':flags.includes(i)?'#f80':red(p)?'#b22':'#222'} strokeWidth={sel===i||flags.includes(i)?4:2}/>
        <text x={X(c)} y={Y(r)+8} textAnchor="middle" fontSize="24" fontWeight="700" fill={red(p)?'#b22':'#222'}>{glyph(p)}</text></>}
        {targets.includes(i)&&<circle cx={X(c)} cy={Y(r)} r="7" fill="#2a7" opacity=".7" pointerEvents="none"/>}</g>})}
    </svg>
    <div className="panel">
      <h2 style={{margin:0}}>象棋 Xiangqi</h2><div className="msg">{status}</div>{chk&&!noMoves&&<div className="warn">⚠ {who} general is in check!{turn===human?' Capture the attacker, block, or move the general.':''}</div>}{note&&<div className="note">{note}</div>}<div className="msg">{msg}</div>
      <div className="row"><button className={mode==='play'?'on':''} onClick={play}>Play vs engine</button>
        <button className={mode==='edit'?'on':''} onClick={()=>setMode('edit')}>Set up position</button></div>
      <div className="row"><select value={lv} onChange={e=>setLv(+e.target.value)}>{LEVELS.map((l,i)=><option key={i} value={i}>{l}</option>)}</select>
        <select value={human} onChange={e=>setHuman(e.target.value)}><option value="w">You: Red</option><option value="b">You: Black</option></select></div>
      <div className="row"><button onClick={undo}>Undo</button><button onClick={()=>{setMode('play');load(START)}}>New game</button></div>
      {mode==='edit'&&<>
        <div className="row">{PIECES.map(p=><button key={p} className={pal===p?'on':''} onClick={()=>setPal(p)} style={{color:red(p)?'#f77':'#ddd'}}>{glyph(p)}</button>)}
          <button className={pal==='x'?'on':''} onClick={()=>setPal('x')}>Erase</button></div>
        <div className="row"><select value={turn} onChange={e=>setTurn(e.target.value)}><option value="w">Red to move</option><option value="b">Black to move</option></select>
          <button onClick={()=>setB(Array(90).fill(''))}>Clear</button>{hasDet&&<button onClick={aiReread}>Re-read with AI</button>}</div>
        <div className="row">Shift all: <button onClick={()=>shift(0,-1)}>←</button><button onClick={()=>shift(0,1)}>→</button><button onClick={()=>shift(-1,0)}>↑</button><button onClick={()=>shift(1,0)}>↓</button></div></>}
      <div className="row"><input value={fen} onChange={e=>setFen(e.target.value)} placeholder="FEN"/>
        <button onClick={()=>load(fen)}>Load</button><button onClick={()=>setFen(toFen(b,turn))}>Get</button></div>
      <label>Image to position: <input type="file" accept="image/*" onChange={e=>scan(e.target.files[0])}/></label>
    </div></div>;
}
