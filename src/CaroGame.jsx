import {useEffect,useMemo,useRef,useState} from 'react';
import {winAt,newBoard,playerAt,SIZES} from './caro.js';
import {CARO_LEVELS} from './caroAI.js';
const CS=32;
const ld=(k,d)=>{try{const v=localStorage.getItem('caro_'+k);return v===null?d:JSON.parse(v)}catch(e){return d}};
const sv=(k,v)=>{try{localStorage.setItem('caro_'+k,JSON.stringify(v))}catch(e){}};
export default function CaroGame({onHome}){
  const [N,setN]=useState(()=>SIZES.includes(ld('N',15))?ld('N',15):15),[rule,setRule]=useState(()=>ld('rule','free')),[vs,setVs]=useState(()=>ld('vs','ai')),[lv,setLv]=useState(()=>Math.min(CARO_LEVELS.length-1,Math.max(0,ld('lv',2)))),[human,setHuman]=useState(1);
  const [moves,setMoves]=useState([]),[busy,setBusy]=useState(false),[hover,setHover]=useState(null),[note,setNote]=useState('');
  const wk=useRef(),job=useRef(0);
  const b=useMemo(()=>{const a=newBoard(N);for(const m of moves)a[m.i]=m.p;return a},[moves,N]);
  const last=moves.length?moves[moves.length-1]:null,win=useMemo(()=>last?winAt(b,N,last.i,rule):null,[b,last,N,rule]);
  const draw=!win&&moves.length>=N*N,over=!!win||draw,turn=playerAt(moves.length),ai=vs==='ai';
  const reset=()=>{job.current++;setMoves([]);setBusy(false);setNote('')};
  const set=(k,fn,v)=>{fn(v);sv(k,v);reset()};
  useEffect(()=>()=>{wk.current&&wk.current.terminate()},[]);
  useEffect(()=>{
    if(!ai||over||turn===human)return;
    wk.current??=new Worker(new URL('./caro.worker.js',import.meta.url),{type:'module'});
    const id=++job.current,w=wk.current;setBusy(true);
    w.onmessage=e=>{if(e.data.id!==job.current)return;setBusy(false);if(e.data.move!=null){setMoves(m=>[...m,{i:e.data.move,p:turn}]);if(e.data.info&&e.data.info.depth>1)setNote(`AI looked ${e.data.info.depth} moves ahead in ${(e.data.info.ms/1000).toFixed(1)}s`);else setNote('')}};
    w.postMessage({id,board:b,N,player:turn,level:lv,rule});
    return()=>{job.current++;setBusy(false)};
  },[moves,N,rule,vs,lv,human,over]);
  const click=i=>{if(over||busy||b[i]||(ai&&turn!==human))return;setNote('');setMoves(m=>[...m,{i,p:turn}])};
  const undo=()=>{if(!moves.length)return;const k=ai&&turn===human?2:1;setMoves(m=>m.slice(0,Math.max(0,m.length-k)));setNote('')};
  const name=p=>p===1?'X':'O',who=p=>!ai?name(p):p===human?`You (${name(p)})`:`AI (${name(p)})`;
  const status=win?`${ai?(last.p===human?'You win! 🎉':'The AI wins'):`${name(last.p)} wins!`} — five in a row`:draw?'Draw: the board is full':`${who(turn)} to move`+(busy?' (thinking…)':'');
  const size=N*CS,winSet=new Set(win||[]),wl=win&&win.length?[win[0],win[win.length-1]]:null,xy=i=>[(i%N)*CS+CS/2,((i/N)|0)*CS+CS/2];
  const lines=[];for(let k=0;k<=N;k++){lines.push(<path key={'h'+k} d={`M0 ${k*CS}H${size}`}/>,<path key={'v'+k} d={`M${k*CS} 0V${size}`}/>)}
  return <div className="wrap"><div className="boardbox sq">
    <svg className="board" viewBox={`0 0 ${size} ${size}`} style={{background:'#f1e6c8'}} onMouseLeave={()=>setHover(null)}>
      <g stroke="#a89c78" strokeWidth="1">{lines}</g>
      {last&&<rect x={(last.i%N)*CS+1} y={((last.i/N)|0)*CS+1} width={CS-2} height={CS-2} fill="rgba(255,214,0,.4)"/>}
      {[...winSet].map(i=><rect key={'w'+i} x={(i%N)*CS+1} y={((i/N)|0)*CS+1} width={CS-2} height={CS-2} fill="rgba(46,170,90,.35)"/>)}
      {b.map((p,i)=>{const[cx,cy]=xy(i);return <g key={i} onClick={()=>click(i)} onMouseEnter={()=>setHover(i)} style={{cursor:!p&&!over?'pointer':'default'}}>
        <rect x={(i%N)*CS} y={((i/N)|0)*CS} width={CS} height={CS} fill="transparent"/>
        {p===1&&<path d={`M${cx-8} ${cy-8}L${cx+8} ${cy+8}M${cx+8} ${cy-8}L${cx-8} ${cy+8}`} stroke="#d33" strokeWidth="3.5" strokeLinecap="round"/>}
        {p===2&&<circle cx={cx} cy={cy} r="9" fill="none" stroke="#2e86de" strokeWidth="3.5"/>}
        {!p&&hover===i&&!over&&(!ai||turn===human)&&!busy&&<g opacity=".3">{turn===1?<path d={`M${cx-8} ${cy-8}L${cx+8} ${cy+8}M${cx+8} ${cy-8}L${cx-8} ${cy+8}`} stroke="#d33" strokeWidth="3.5" strokeLinecap="round"/>:<circle cx={cx} cy={cy} r="9" fill="none" stroke="#2e86de" strokeWidth="3.5"/>}</g>}</g>})}
      {wl&&<line x1={xy(wl[0])[0]} y1={xy(wl[0])[1]} x2={xy(wl[1])[0]} y2={xy(wl[1])[1]} stroke="#1a8f4a" strokeWidth="5" strokeLinecap="round" opacity=".85"/>}
    </svg></div>
    <div className="panel">
      <div className="row"><button onClick={onHome}>← All games</button></div>
      <h2 style={{margin:0}}>Cờ Caro · Gomoku</h2><div className="msg">{status}</div>{note&&<div className="note">{note}</div>}
      <div className="note" style={{color:'#bbb'}}>Move {moves.length}{last?` · last: ${String.fromCharCode(97+last.i%N)}${N-((last.i/N)|0)} by ${name(last.p)}`:''}</div>
      <div className="row"><button className={ai?'on':''} onClick={()=>set('vs',setVs,'ai')}>vs AI</button><button className={!ai?'on':''} onClick={()=>set('vs',setVs,'two')}>2 players</button></div>
      {ai&&<div className="row"><select value={lv} onChange={e=>set('lv',setLv,+e.target.value)}>{CARO_LEVELS.map((l,i)=><option key={i} value={i}>{l.name}</option>)}</select>
        <select value={human} onChange={e=>{setHuman(+e.target.value);reset()}}><option value={1}>You: X (first)</option><option value={2}>You: O (second)</option></select></div>}
      <div className="row"><select value={N} onChange={e=>set('N',setN,+e.target.value)}>{SIZES.map(s=><option key={s} value={s}>{s}×{s} board</option>)}</select>
        <label style={{display:'flex',gap:6,alignItems:'center',fontSize:14}}><input type="checkbox" checked={rule==='vn'} onChange={e=>set('rule',setRule,e.target.checked?'vn':'free')}/>Blocked-both-ends rule</label></div>
      <div className="note" style={{color:'#999'}}>{rule==='vn'?'Five in a row wins unless BOTH ends are blocked by the opponent (board edges do not block).':'Five or more in a row wins.'}</div>
      <div className="row"><button onClick={undo} disabled={!moves.length}>Undo</button><button onClick={reset}>New game</button></div>
    </div></div>}
