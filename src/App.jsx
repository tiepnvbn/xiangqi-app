import {useEffect,useMemo,useRef,useState} from 'react';
import {START,parse,parseLoose,toFen,legal,apply,inCheck,red,pseudo,checkers,kingOf,outcome} from './xq.js';
import {detect,finishCore,recognize,decodeTemplates,corrections,packTemplate,fixCell,loadUserTemplates,addUserTemplates,clearUserTemplates} from './vision.js';
import {notes,gameText} from './notation.js';
import {newGame,legalUp,pseudoUp,applyUp,inCheckUp,checkersUp,kingSq,outcomeUp,unseen,FULL} from './jieqi.js';
import TPL from './templates.json';
const TP=decodeTemplates(TPL);
const GR={r:'車',n:'馬',b:'相',a:'仕',k:'帥',c:'炮',p:'兵'},GB={r:'車',n:'馬',b:'象',a:'士',k:'將',c:'砲',p:'卒'};
const glyph=p=>(red(p)?GR:GB)[p.toLowerCase()];
const LEVELS=['Beginner','Easy','Medium','Hard','Expert (~4s)','Master (~10s)'];
const NAME={R:'Rook',N:'Horse',B:'Elephant',A:'Advisor',C:'Cannon',P:'Soldier',K:'General'},NO_HID=Array(90).fill(false);
const sqName=i=>String.fromCharCode(97+i%9)+(9-((i/9)|0));
const X=c=>30+c*50,Y=r=>30+r*50,PIECES='KABNRCPkabnrcp'.split('');
// the little corner marks printed at the cannon and soldier points of a real board
const MARKS=[[2,1],[2,7],[7,1],[7,7],...[3,6].flatMap(r=>[0,2,4,6,8].map(c=>[r,c]))];
const markPath=(r,c)=>{const x=X(c),y=Y(r),g=5,l=10;let d='';for(const sx of[-1,1])for(const sy of[-1,1]){if((c===0&&sx<0)||(c===8&&sx>0))continue;d+=`M${x+sx*(g+l)},${y+sy*g}H${x+sx*g}V${y+sy*(g+l)}`}return d};
const keyUpS=x=>x.b.map((p,i)=>p?(x.hid[i]?'?':p):'.').join('')+x.turn;
// move list for cờ úp: "?b9-c7=N" = a face-down piece moved from b9 to c7 and turned out to be a Horse; "x" = capture, "+" = check
function upNotes(states){return states.slice(1).map((s,k)=>{const a=states[k],m=s.last;if(!m)return'';const hidden=a.hid[m[0]];
  return(hidden?'?':'')+sqName(m[0])+(s.cap?'x':'-')+sqName(m[1])+(hidden?'='+s.b[m[1]].toUpperCase():'')+(inCheckUp(s.b,s.hid,s.turn)?'+':'')})}
function upGameText(mv,res){let o='[Variant "Co up (jieqi)"]\n[Result "'+res+'"]\n\n';mv.forEach((t,i)=>{o+=(i%2===0?(i/2+1)+'. ':'')+t+' '});return o.trim()+'\n\nNotation: files a-i left to right and ranks 0-9 from Red\'s side (Red starts on ranks 9-6). "?" = face-down piece moved, "=X" = what it turned out to be, x = capture, + = check.\n'}
function UpInfo({b,hid}){
  const row=side=>{const lost=FULL.slice(),extra={};for(let i=0;i<90;i++){const p=b[i];if(!p||(p===p.toUpperCase())!==(side==='w')||p.toUpperCase()==='K')continue;const k=p.toUpperCase(),j=lost.indexOf(k);if(j>=0)lost.splice(j,1)}
    const un=unseen(b,hid,side),face=Object.entries(un).map(([k,n])=>n+'× '+NAME[k]).join(', ');
    return <div key={side} className="note"><b>{side==='w'?'Red':'Black'}</b> · face-down pieces left: {Object.values(un).reduce((a,x)=>a+x,0)}{face?` (${face})`:''}{lost.length?` · captured: ${lost.map(k=>glyph(side==='w'?k:k.toLowerCase())).join(' ')}`:''}</div>};
  return <div className="fixbox"><div className="note">Every piece except the generals starts face-down (shown as ?). A face-down piece moves like the piece that normally starts on that point, then turns over and moves as what it really is. Nobody knows what a face-down piece is until it moves or is captured.</div>{row('w')}{row('b')}</div>}
export default function App({game='std',onHome}){
  const [g0]=useState(()=>game==='up'?newGame():null);
  const [b,setB]=useState(()=>g0?g0.b:parse(START).b),[turn,setTurn]=useState('w'),[hist,setHist]=useState([]),[hid,setHid]=useState(()=>g0?g0.hid:NO_HID);
  const variant=game;
  const up=variant==='up';
  const [sel,setSel]=useState(null),[mode,setMode]=useState('play'),[lv,setLv]=useState(3),[human,setHuman]=useState('w');
  const [flags,setFlags]=useState([]),[fix,setFix]=useState(null),[userT,setUserT]=useState(()=>decodeTemplates(loadUserTemplates(),true)),[hasDet,setHasDet]=useState(false),[view,setView]=useState(null),[flip,setFlip]=useState(false),[online,setOnline]=useState(typeof navigator==='undefined'?true:navigator.onLine),[last,setLast]=useState(null),[cap,setCap]=useState(false),[note,setNote]=useState(''),[busy,setBusy]=useState(false),[pal,setPal]=useState(null),[learnedCells,setLearnedCells]=useState([]),[fen,setFen]=useState(''),[msg,setMsg]=useState('');
  const wk=useRef(),job=useRef(0),detRef=useRef(null),scanInfo=useRef(null),histRef=useRef(null);
  const ms=useMemo(()=>mode==='play'?(up?legalUp(b,hid,turn):legal(b,turn)):[],[b,hid,turn,mode,up]);
  const states=useMemo(()=>[...hist.map(h=>({b:h.b,hid:h.hid,turn:h.turn,last:h.last,cap:h.cap})),{b,hid,turn,last,cap}],[hist,b,hid,turn,last,cap]),tl=states;
  const res=useMemo(()=>mode==='play'&&ms.length?(up?outcomeUp(tl):outcome(tl)):null,[tl,mode,ms,up]);
  const noMoves=mode==='play'&&!ms.length,over=noMoves||!!res;
  const chk=mode==='play'&&(up?inCheckUp(b,hid,turn):inCheck(b,turn)),atk=chk?(up?checkersUp(b,hid,turn):checkers(b,turn)):[];
  const move=m=>{setHist(h=>[...h,{b,hid,turn,last,cap}]);setLast(m);setTurn(turn==='w'?'b':'w');setSel(null);setNote('');
    if(up){const r=applyUp(b,hid,m);setCap(!!r.captured);setB(r.b);setHid(r.hid);return r.revealed?`${turn==='w'?'Red':'Black'} turned over ${'AEIOU'.includes(NAME[r.revealed.toUpperCase()][0])?'an':'a'} ${NAME[r.revealed.toUpperCase()]}. `:''}
    setCap(!!b[m[1]]);setB(apply(b,m));return ''};
  useEffect(()=>{
    if(mode!=='play'||over||turn===human)return;
    wk.current??=new Worker(new URL('./engine.worker.js',import.meta.url),{type:'module'});
    const id=++job.current,w=wk.current;setBusy(true);
    w.onmessage=e=>{if(e.data.id!==job.current)return;setBusy(false);if(e.data.move){const t=move(e.data.move);if(e.data.info&&e.data.info.depth)setNote(t+(up?`Engine tried ${e.data.info.depth} possible deals of the hidden pieces in ${(e.data.info.ms/1000).toFixed(1)}s`:`Engine searched ${e.data.info.depth} moves deep in ${(e.data.info.ms/1000).toFixed(1)}s`));else if(t)setNote(t)}};
    if(up)w.postMessage({id,variant:'up',b,hid,turn,keys:tl.slice(0,-1).map(x=>keyUpS(x)),level:lv});else w.postMessage({id,b,turn,timeline:tl.map(x=>({b:x.b,turn:x.turn})),level:lv});
    return()=>{job.current++;setBusy(false)};
  },[b,hid,turn,mode,human,lv,over,up]);
  useEffect(()=>()=>{wk.current&&wk.current.terminate()},[]);
  const click=i=>{
    if(mode==='edit'){
      if(b[i]&&pal!=='x'){setFix(i);return}   // tapping a piece opens a choice panel: nothing is replaced by accident
      if(pal!=='x'&&!pal){setNote('Choose a piece in the palette first, then tap an empty point.');return}
      setFlags(f=>f.filter(x=>x!==i));setLearnedCells(f=>f.filter(x=>x!==i));const n=b.slice();n[i]=pal==='x'?'':pal;setB(n);setFix(null);setNote('');return}
    if(view!==null){setNote('Reviewing an earlier position. Press "Back to game" to continue.');return}
    if(over||busy||turn!==human)return;
    const mine=b[i]&&red(b[i])===(turn==='w');
    if(sel!==null&&ms.some(m=>m[0]===sel&&m[1]===i))return move([sel,i]);
    if(mine){setSel(i);setNote(ms.some(m=>m[0]===i)?'':chk?'This piece cannot get your general out of check.':'This piece has no legal moves (moving it would expose your general, or it is blocked).');return}
    if(sel!==null&&(up?pseudoUp(b,hid,turn):pseudo(b,turn)).some(m=>m[0]===sel&&m[1]===i))setNote(chk?'Your general is in check! You must capture the attacker, block the attack, or move the general.':'Illegal: that move would leave your general under attack (or facing the enemy general).');
    else{setNote('');setSel(null)}
  };
  const load=f=>{const p=parse(f);if(!p)return setMsg('Invalid FEN');setHid(NO_HID);setB(p.b);setTurn(p.turn);setHist([]);setSel(null);setLast(null);setCap(false);setNote('');setView(null);setMsg('')};
  const startVariant=v=>{setMode('play');setFlags([]);setFix(null);setLearnedCells([]);setHist([]);setSel(null);setLast(null);setCap(false);setNote('');setView(null);setMsg('');scanInfo.current=null;
    if(v==='up'){const g=newGame();setB(g.b);setHid(g.hid);setTurn('w')}else{const p=parse(START);setHid(NO_HID);setB(p.b);setTurn('w')}};
  const undo=()=>{if(!hist.length)return;const k=turn===human&&hist.length>1?2:1,h=hist[hist.length-k];setB(h.b);setHid(h.hid||NO_HID);setTurn(h.turn);setLast(h.last);setCap(h.cap);setHist(hist.slice(0,-k));setSel(null);setNote('');setView(null)};
  const play=()=>{setFlags([]);if(!b.includes('K')||!b.includes('k'))return setMsg('Both generals are required.');scanInfo.current=null;setFix(null);setLearnedCells([]);setMsg('');
    setHist([]);setSel(null);setLast(null);setCap(false);setNote('');setView(null);setMode('play')};
  const corr=mode==='edit'&&scanInfo.current?corrections(scanInfo.current,b):[];
  const teach=()=>{const list=corr.map(c=>packTemplate(c.to,c.vec));addUserTemplates(list);setUserT(decodeTemplates(loadUserTemplates(),true));scanInfo.current=null;setMsg(`Saved ${list.length} correction${list.length>1?'s':''} on this device. Use "Forget saved corrections" to undo.`)};
  const applyFix=c=>{if(fix===null)return;setB(fixCell(b,fix,c,pal));setFlags(f=>f.filter(x=>x!==fix));setFix(null)};
  async function scan(file){if(!file)return;setMsg('Detecting pieces…');setFlags([]);setHist([]);setLast(null);setCap(false);setView(null);setSel(null);setNote('');
    const t0=performance.now();let d=null,loc=null;
    scanInfo.current=null;setFix(null);setLearnedCells([]);
    try{d=await detect(file);if(d)loc=recognize(d,[...TP,...userT])}catch(e){}
    detRef.current=d;setHasDet(!!d);const secs=((performance.now()-t0)/1000).toFixed(1);
    if(loc&&loc.bad===0){scanInfo.current=loc.info;const lc=Object.keys(loc.info).filter(k=>loc.info[k].user).map(Number);setLearnedCells(lc);setB(loc.board);setTurn('w');setFlags(loc.unsure);setMode('edit');
      setMsg(`Recognised ${d.P.length} pieces on this device in ${secs}s.`+(loc.unsure.length?' Orange rings = please double-check.':'')+(lc.length?` Purple rings: ${lc.length} piece(s) were read using your saved corrections; if one is wrong, press "Forget saved corrections".`:'')+(loc.flipped?' (Board was rotated; shown with Red at the bottom.)':'')+' Tap a piece to change it, then press Play.');return}
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
  const n=states.length-1,cur=view??n,goto=k=>{k=Math.max(0,Math.min(n,k));setView(k===n?null:k);setSel(null)};
  const sv=view!==null&&mode==='play'?states[Math.min(view,n)]:null,db=sv?sv.b:b,dHid=sv?sv.hid:hid,dTurn=sv?sv.turn:turn,dLast=mode==='play'?(sv?sv.last:last):null;
  const dchk=mode==='play'&&(up?inCheckUp(db,dHid,dTurn):inCheck(db,dTurn)),datk=dchk?(up?checkersUp(db,dHid,dTurn):checkers(db,dTurn)):[],dKing=dchk?(up?kingSq(db,dTurn):kingOf(db,dTurn)):-1,dWho=dTurn==='w'?'Red':'Black';
  const fl=flip!==(human==='b'),px=i=>X(fl?8-i%9:i%9),py=i=>Y(fl?9-((i/9)|0):((i/9)|0));
  const mv=useMemo(()=>up?upNotes(states):notes(states),[states,up]);
  const resStr=res?(res.winner==='w'?'1-0':res.winner==='b'?'0-1':'1/2-1/2'):noMoves?(turn==='w'?'0-1':'1-0'):'*';
  const exportText=()=>up?upGameText(mv,resStr):gameText(states,resStr,new Date().toISOString().slice(0,10).replace(/-/g,'.'));
  const copyMoves=async()=>{try{await navigator.clipboard.writeText(exportText());setMsg('Game copied to the clipboard.')}catch(e){setMsg('Could not copy; use Download game instead.')}};
  const downloadGame=()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([exportText()],{type:'text/plain'}));a.download=up?'co-up-game.txt':'xiangqi-game.txt';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000)};
  const playFrom=()=>{if(view===null)return;const st=states[view];setHist(hist.slice(0,view));setB(st.b);setHid(st.hid||NO_HID);setTurn(st.turn);setLast(st.last);setCap(!!st.cap);setView(null);setSel(null);setNote('')};
  useEffect(()=>{const on=()=>setOnline(true),off=()=>setOnline(false);window.addEventListener('online',on);window.addEventListener('offline',off);return()=>{window.removeEventListener('online',on);window.removeEventListener('offline',off)}},[]);
  useEffect(()=>{const h=e=>{if(mode!=='play'||/INPUT|SELECT|TEXTAREA/.test(e.target.tagName))return;if(e.key==='ArrowLeft'){e.preventDefault();goto(cur-1)}else if(e.key==='ArrowRight'){e.preventDefault();goto(cur+1)}};window.addEventListener('keydown',h);return()=>window.removeEventListener('keydown',h)});
  useEffect(()=>{const el=histRef.current;if(el&&view===null)el.scrollTop=el.scrollHeight},[n,view]);
  const targets=sel!==null?ms.filter(m=>m[0]===sel).map(m=>m[1]):[];
  const who=turn==='w'?'Red':'Black',other=turn==='w'?'Black':'Red';
  const status=mode==='edit'?'Edit mode':noMoves?(chk?`Checkmate! ${other} wins`:`${who} has no legal moves: ${other} wins`):res?res.text:`${who} to move`+(busy?' (thinking…)':'');
  const lines=[];for(let r=0;r<10;r++)lines.push([X(0),Y(r),X(8),Y(r)]);
  for(let c=0;c<9;c++){if(c===0||c===8)lines.push([X(c),Y(0),X(c),Y(9)]);else lines.push([X(c),Y(0),X(c),Y(4)],[X(c),Y(5),X(c),Y(9)])}
  [[3,0,5,2],[5,0,3,2],[3,7,5,9],[5,7,3,9]].forEach(([a,r,c,s])=>lines.push([X(a),Y(r),X(c),Y(s)]));
  return <div className="wrap"><div className="boardbox">
    <svg className="board" viewBox="0 0 460 510">
      {lines.map((l,i)=><line key={i} x1={l[0]} y1={l[1]} x2={l[2]} y2={l[3]} stroke="#5a3a1a" strokeWidth="1.5"/>)}
      {MARKS.map(([r,c])=><path key={'m'+r+c} d={markPath(r,c)} fill="none" stroke="#5a3a1a" strokeWidth="1.5"/>)}
      {dLast&&<><circle cx={px(dLast[0])} cy={py(dLast[0])} r="22" fill="none" stroke="#c9a000" strokeWidth="3" strokeDasharray="5 4"/>
        <circle cx={px(dLast[1])} cy={py(dLast[1])} r="27" fill="rgba(255,214,0,.35)" stroke="#e6b800" strokeWidth="3"/></>}
      {datk.map(i=><circle key={'a'+i} cx={px(i)} cy={py(i)} r="26" fill="none" stroke="#e53935" strokeWidth="3" strokeDasharray="4 3"/>)}
      {dKing>=0&&<circle cx={px(dKing)} cy={py(dKing)} r="26" fill="rgba(229,57,53,.35)" stroke="#e53935" strokeWidth="4"><animate attributeName="r" values="24;31;24" dur="0.9s" repeatCount="indefinite"/></circle>}
      {!sv&&learnedCells.map(i=><circle key={'l'+i} cx={px(i)} cy={py(i)} r="28" fill="none" stroke="#ab47bc" strokeWidth="3" strokeDasharray="3 3"/>)}
      {fix!==null&&<circle cx={px(fix)} cy={py(fix)} r="28" fill="none" stroke="#1e88e5" strokeWidth="3" strokeDasharray="5 3"/>}
      {db.map((p,i)=>{const cx=px(i),cy=py(i);return <g key={i} onClick={()=>click(i)} style={{cursor:'pointer'}}>
        <circle cx={cx} cy={cy} r="23" fill="transparent"/>
        {p&&<><circle cx={cx} cy={cy} r="21" fill={dHid[i]?'#b98b52':'#f6e3b4'} stroke={sel===i?'#2a7':!sv&&flags.includes(i)?'#f80':red(p)?'#b22':'#222'} strokeWidth={sel===i||(!sv&&flags.includes(i))?4:2}/>
        {dHid[i]?<><circle cx={cx} cy={cy} r="15" fill="none" stroke={red(p)?'#b22':'#222'} strokeWidth="1.5" opacity=".6"/><text x={cx} y={cy+8} textAnchor="middle" fontSize="22" fontWeight="700" fill={red(p)?'#b22':'#222'}>?</text></>
        :<text x={cx} y={cy+8} textAnchor="middle" fontSize="24" fontWeight="700" fill={red(p)?'#b22':'#222'}>{glyph(p)}</text>}</>}
        {!sv&&targets.includes(i)&&<circle cx={cx} cy={cy} r="7" fill="#2a7" opacity=".7" pointerEvents="none"/>}</g>})}
    </svg></div>
    <div className="panel">
      {onHome&&<div className="row"><button onClick={onHome}>← All games</button></div>}<h2 style={{margin:0}}>{up?'Cờ Úp · Hidden Xiangqi':'Cờ Tướng · Xiangqi'}</h2><div className="msg">{status}</div>{sv&&<div className="note">Reviewing move {view} of {n}. Arrow keys ◀ ▶ step through the game.</div>}{dchk&&(sv||!noMoves)&&<div className="warn">⚠ {dWho} general is in check!{!sv&&turn===human?' Capture the attacker, block, or move the general.':''}</div>}{!online&&<div className="note">Offline: playing and photo scanning on this device still work; only the AI fallback needs a connection.</div>}{note&&<div className="note">{note}</div>}<div className="msg">{msg}</div>
      {!up&&<div className="row"><button className={mode==='play'?'on':''} onClick={play}>Play vs engine</button>
        <button className={mode==='edit'?'on':''} onClick={()=>{setView(null);setMode('edit')}}>Set up position</button></div>}
      <div className="row"><select value={lv} onChange={e=>setLv(+e.target.value)}>{LEVELS.map((l,i)=><option key={i} value={i}>{l}</option>)}</select>
        <select value={human} onChange={e=>setHuman(e.target.value)}><option value="w">You: Red</option><option value="b">You: Black</option></select></div>
      <div className="row"><button onClick={undo}>Undo</button><button onClick={()=>setFlip(f=>!f)}>Flip board</button><button onClick={()=>startVariant(variant)}>New game</button></div>
      {up&&<UpInfo b={b} hid={hid}/>}
      {mode==='play'&&<><div className="hist" ref={histRef}>{mv.length===0&&<span className="note">No moves yet</span>}
        {mv.map((t,i)=>{const first=states[0].turn,mover=i%2===0?first:first==='w'?'b':'w';
          return <span key={i}>{mover==='w'&&<span className="no">{Math.floor((i+(first==='w'?0:1))/2)+1}.</span>}<button className={'mv'+(cur===i+1?' cur':'')} onClick={()=>goto(i+1)}>{t}</button></span>})}</div>
        <div className="row"><button onClick={()=>goto(0)}>⏮</button><button onClick={()=>goto(cur-1)}>◀</button><button onClick={()=>goto(cur+1)}>▶</button><button onClick={()=>goto(n)}>⏭</button>{sv&&<button onClick={()=>setView(null)}>Back to game</button>}</div>
        {sv&&<div className="row"><button onClick={playFrom}>Play from this position</button></div>}
        <div className="row"><button onClick={copyMoves}>Copy moves</button><button onClick={downloadGame}>Download game</button></div></>}
      {mode==='edit'&&<>
        {fix!==null&&b[fix]&&(()=>{const inf=scanInfo.current&&scanInfo.current[fix],isRed=b[fix]===b[fix].toUpperCase(),order=[...new Set([...(inf?[inf.cls,...inf.alts]:[]),...'KABNRCP'])];
          return <div className="fixbox"><div className="note">{inf&&flags.includes(fix)?'Unsure piece: what is it?':'Change this piece to:'}</div>
            <div className="row">{order.map(c=><button key={c} className={b[fix].toUpperCase()===c?'on':''} onClick={()=>applyFix(c)}>{glyph(isRed?c:c.toLowerCase())}</button>)}</div>
            <div className="row"><button disabled={!pal||pal==='x'} onClick={()=>applyFix('pal')}>Use palette piece</button><button onClick={()=>applyFix('x')}>Remove</button><button onClick={()=>setFix(null)}>Cancel</button></div></div>})()}
        {corr.length>0&&<div className="fixbox"><div className="note">You changed: {corr.map(c=>glyph(b[c.cell]===b[c.cell].toUpperCase()?c.from:c.from.toLowerCase())+' → '+glyph(b[c.cell])).join('   ')}</div>
          <div className="row"><button onClick={teach}>Teach the app (only if the new piece is right)</button></div></div>}
        <div className="row">{PIECES.map(p=><button key={p} className={pal===p?'on':''} onClick={()=>setPal(p)} style={{color:red(p)?'#f77':'#ddd'}}>{glyph(p)}</button>)}
          <button className={pal==='x'?'on':''} onClick={()=>setPal('x')}>Erase</button></div>
        <div className="row"><select value={turn} onChange={e=>setTurn(e.target.value)}><option value="w">Red to move</option><option value="b">Black to move</option></select>
          <button onClick={()=>setB(Array(90).fill(''))}>Clear</button>{hasDet&&<button onClick={aiReread}>Re-read with AI</button>}</div>
        {userT.length>0&&<div className="row"><button onClick={()=>{clearUserTemplates();setUserT([]);setMsg('Saved corrections cleared.')}}>Forget saved corrections ({userT.length})</button></div>}
        <div className="row">Shift all: <button onClick={()=>shift(0,-1)}>←</button><button onClick={()=>shift(0,1)}>→</button><button onClick={()=>shift(-1,0)}>↑</button><button onClick={()=>shift(1,0)}>↓</button></div></>}
      {!up&&<><div className="row"><input value={fen} onChange={e=>setFen(e.target.value)} placeholder="FEN"/>
        <button onClick={()=>load(fen)}>Load</button><button onClick={()=>setFen(toFen(b,turn))}>Get</button></div>
      <label>Image to position: <input type="file" accept="image/*" onChange={e=>{const f=e.target.files[0];e.target.value='';scan(f)}}/></label></>}
    </div></div>;
}
