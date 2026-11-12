import {useEffect,useMemo,useRef,useState} from 'react';
import {START,parse,toFen,legal,apply,inCheck,red} from './xq.js';
const GR={r:'車',n:'馬',b:'相',a:'仕',k:'帥',c:'炮',p:'兵'},GB={r:'車',n:'馬',b:'象',a:'士',k:'將',c:'砲',p:'卒'};
const glyph=p=>(red(p)?GR:GB)[p.toLowerCase()];
const LV=[{n:'Beginner',depth:1,noise:120},{n:'Easy',depth:2,noise:40},{n:'Medium',depth:3,noise:0},{n:'Hard',depth:4,noise:0}];
const X=c=>30+c*50,Y=r=>30+r*50,PIECES='KABNRCPkabnrcp'.split('');
export default function App(){
  const [b,setB]=useState(parse(START).b),[turn,setTurn]=useState('w'),[hist,setHist]=useState([]);
  const [sel,setSel]=useState(null),[mode,setMode]=useState('play'),[lv,setLv]=useState(1),[human,setHuman]=useState('w');
  const [busy,setBusy]=useState(false),[pal,setPal]=useState('P'),[fen,setFen]=useState(''),[msg,setMsg]=useState('');
  const wk=useRef(),job=useRef(0);
  const ms=useMemo(()=>mode==='play'?legal(b,turn):[],[b,turn,mode]);
  const over=mode==='play'&&!ms.length,chk=mode==='play'&&!over&&inCheck(b,turn);
  const move=m=>{setHist(h=>[...h,{b,turn}]);setB(apply(b,m));setTurn(turn==='w'?'b':'w');setSel(null)};
  useEffect(()=>{
    if(mode!=='play'||over||turn===human)return;
    wk.current??=new Worker(new URL('./engine.worker.js',import.meta.url),{type:'module'});
    const id=++job.current,w=wk.current;setBusy(true);
    w.onmessage=e=>{if(e.data.id!==job.current)return;setBusy(false);e.data.move&&move(e.data.move)};
    w.postMessage({id,b,side:turn,...LV[lv]});
    return()=>{job.current++;setBusy(false)};
  },[b,turn,mode,human,lv,over]);
  const click=i=>{
    if(mode==='edit'){const n=b.slice();n[i]=pal==='x'?'':pal;setB(n);return}
    if(over||busy||turn!==human)return;
    if(sel!==null&&ms.some(m=>m[0]===sel&&m[1]===i))move([sel,i]);
    else setSel(b[i]&&red(b[i])===(turn==='w')?i:null);
  };
  const load=f=>{const p=parse(f);if(!p)return setMsg('Invalid FEN');setB(p.b);setTurn(p.turn);setHist([]);setSel(null);setMsg('')};
  const undo=()=>{if(!hist.length)return;const k=turn===human&&hist.length>1?2:1,h=hist[hist.length-k];setB(h.b);setTurn(h.turn);setHist(hist.slice(0,-k));setSel(null)};
  const play=()=>{if(!b.includes('K')||!b.includes('k'))return setMsg('Both generals are required.');setMsg('');setHist([]);setSel(null);setMode('play')};
  async function scan(file){if(!file)return;setMsg('Scanning… (can take up to ~30s)');
    try{const img=await createImageBitmap(file),s=Math.min(1,1280/Math.max(img.width,img.height)),c=document.createElement('canvas');
      c.width=img.width*s;c.height=img.height*s;c.getContext('2d').drawImage(img,0,0,c.width,c.height);
      const r=await fetch('/api/scan',{method:'POST',signal:AbortSignal.timeout(70000),headers:{'content-type':'application/json'},body:JSON.stringify({image:c.toDataURL('image/jpeg',.85).split(',')[1]})});
      const j=await r.json(),p=j.fen&&parse(j.fen);if(!p)throw new Error(j.error||'no FEN');
      setB(p.b);setTurn(p.turn);setMode('edit');setMsg('Scanned. Fix any mistakes, then press Play.');
    }catch(e){setMsg('Scan failed: '+(e.name==='TimeoutError'?'timed out, please try again':e.message))}}
  const targets=sel!==null?ms.filter(m=>m[0]===sel).map(m=>m[1]):[];
  const status=mode==='edit'?'Edit mode':over?(turn==='w'?'Black':'Red')+' wins':(chk?'Check! ':'')+(turn==='w'?'Red':'Black')+' to move'+(busy?' (thinking…)':'');
  const lines=[];for(let r=0;r<10;r++)lines.push([X(0),Y(r),X(8),Y(r)]);
  for(let c=0;c<9;c++){if(c===0||c===8)lines.push([X(c),Y(0),X(c),Y(9)]);else lines.push([X(c),Y(0),X(c),Y(4)],[X(c),Y(5),X(c),Y(9)])}
  [[3,0,5,2],[5,0,3,2],[3,7,5,9],[5,7,3,9]].forEach(([a,r,c,s])=>lines.push([X(a),Y(r),X(c),Y(s)]));
  return <div className="wrap">
    <svg viewBox="0 0 460 510" width="460">
      {lines.map((l,i)=><line key={i} x1={l[0]} y1={l[1]} x2={l[2]} y2={l[3]} stroke="#5a3a1a" strokeWidth="1.5"/>)}
      <text x="130" y="285" fontSize="24" fill="#5a3a1a">楚 河</text><text x="270" y="285" fontSize="24" fill="#5a3a1a">漢 界</text>
      {b.map((p,i)=>{const r=i/9|0,c=i%9;return <g key={i} onClick={()=>click(i)} style={{cursor:'pointer'}}>
        <circle cx={X(c)} cy={Y(r)} r="23" fill="transparent"/>
        {p&&<><circle cx={X(c)} cy={Y(r)} r="21" fill="#f6e3b4" stroke={sel===i?'#2a7':red(p)?'#b22':'#222'} strokeWidth={sel===i?4:2}/>
        <text x={X(c)} y={Y(r)+8} textAnchor="middle" fontSize="24" fontWeight="700" fill={red(p)?'#b22':'#222'}>{glyph(p)}</text></>}
        {targets.includes(i)&&<circle cx={X(c)} cy={Y(r)} r="7" fill="#2a7" opacity=".7" pointerEvents="none"/>}</g>})}
    </svg>
    <div className="panel">
      <h2 style={{margin:0}}>象棋 Xiangqi</h2><div className="msg">{status}</div><div className="msg">{msg}</div>
      <div className="row"><button className={mode==='play'?'on':''} onClick={play}>Play vs engine</button>
        <button className={mode==='edit'?'on':''} onClick={()=>setMode('edit')}>Set up position</button></div>
      <div className="row"><select value={lv} onChange={e=>setLv(+e.target.value)}>{LV.map((l,i)=><option key={i} value={i}>{l.n}</option>)}</select>
        <select value={human} onChange={e=>setHuman(e.target.value)}><option value="w">You: Red</option><option value="b">You: Black</option></select></div>
      <div className="row"><button onClick={undo}>Undo</button><button onClick={()=>{setMode('play');load(START)}}>New game</button></div>
      {mode==='edit'&&<>
        <div className="row">{PIECES.map(p=><button key={p} className={pal===p?'on':''} onClick={()=>setPal(p)} style={{color:red(p)?'#f77':'#ddd'}}>{glyph(p)}</button>)}
          <button className={pal==='x'?'on':''} onClick={()=>setPal('x')}>Erase</button></div>
        <div className="row"><select value={turn} onChange={e=>setTurn(e.target.value)}><option value="w">Red to move</option><option value="b">Black to move</option></select>
          <button onClick={()=>setB(Array(90).fill(''))}>Clear</button></div></>}
      <div className="row"><input value={fen} onChange={e=>setFen(e.target.value)} placeholder="FEN"/>
        <button onClick={()=>load(fen)}>Load</button><button onClick={()=>setFen(toFen(b,turn))}>Get</button></div>
      <label>Image to position: <input type="file" accept="image/*" onChange={e=>scan(e.target.files[0])}/></label>
    </div></div>;
}
