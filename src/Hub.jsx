import {useEffect,useState} from 'react';
import {GAMES} from './games.js';
import App from './App.jsx';
import CaroGame from './CaroGame.jsx';
const read=()=>(typeof location==='undefined'?'':location.hash.replace(/^#\/?/,''));
// Hand-drawn icons (no external images, no text characters)
const Disc=({cx,cy,r=15,fill,ring,children})=><g><circle cx={cx} cy={cy} r={r} fill={fill} stroke={ring} strokeWidth="3"/><circle cx={cx} cy={cy} r={r-5} fill="none" stroke={ring} strokeWidth="1.5" opacity=".7"/>{children}</g>;
const ICONS={
  xiangqi:()=><svg viewBox="0 0 96 96" aria-hidden="true"><rect width="96" height="96" rx="18" fill="#e8c98a"/>
    <g stroke="#5a3a1a" strokeWidth="2" fill="none"><path d="M16 22H80M16 38H80M16 58H80M16 74H80M16 22V74M80 22V74M32 22V38M48 22V38M64 22V38M32 58V74M48 58V74M64 58V74M38 22L58 38M58 22L38 38M38 58L58 74M58 58L38 74"/></g>
    <Disc cx={33} cy={48} fill="#f6e3b4" ring="#b22"/><Disc cx={63} cy={48} fill="#f6e3b4" ring="#222"/></svg>,
  jieqi:()=><svg viewBox="0 0 96 96" aria-hidden="true"><rect width="96" height="96" rx="18" fill="#e8c98a"/>
    <Disc cx={36} cy={36} fill="#b98b52" ring="#222"><text x="36" y="45" textAnchor="middle" fontSize="26" fontWeight="700" fill="#222">?</text></Disc>
    <Disc cx={60} cy={58} r={18} fill="#b98b52" ring="#b22"><text x="60" y="68" textAnchor="middle" fontSize="30" fontWeight="700" fill="#b22">?</text></Disc></svg>,
  caro:()=><svg viewBox="0 0 96 96" aria-hidden="true"><rect width="96" height="96" rx="18" fill="#f1e6c8"/>
    <g stroke="#9a8c6a" strokeWidth="1.5">{[1,2,3,4].map(k=><g key={k}><path d={`M12 ${12+k*14.4}H84`}/><path d={`M${12+k*14.4} 12V84`}/></g>)}</g>
    <g stroke="#d33" strokeWidth="5" strokeLinecap="round">{[0,1,2].map(k=><path key={k} d={`M${18+k*24} ${18+k*24}l10 10m0-10l-10 10`}/>)}</g>
    <g fill="none" stroke="#2e86de" strokeWidth="5"><circle cx="71" cy="25" r="6"/><circle cx="25" cy="71" r="6"/><circle cx="47" cy="71" r="6"/></g></svg>};
export default function Hub(){
  const [route,setRoute]=useState(read);
  useEffect(()=>{const f=()=>setRoute(read());window.addEventListener('hashchange',f);return()=>window.removeEventListener('hashchange',f)},[]);
  const go=r=>{location.hash=r?'#/'+r:'#/'};
  if(route==='xiangqi')return <App key="std" game="std" onHome={()=>go('')}/>;
  if(route==='jieqi')return <App key="up" game="up" onHome={()=>go('')}/>;
  if(route==='caro')return <CaroGame onHome={()=>go('')}/>;
  return <main className="hub"><header><h1>Board Games</h1><p>Chọn một trò chơi · Pick a game. Everything runs on your device and works offline.</p></header>
    <div className="cards">{GAMES.map(g=>{const Icon=ICONS[g.id];return <a key={g.id} className="card" href={'#/'+g.id} style={{'--accent':g.color}}>
      <div className="ico"><Icon/></div><div className="ct"><h2>{g.title}</h2><div className="sub">{g.sub}</div><p>{g.desc}</p>
      <div className="tags">{g.tags.map(t=><span key={t} className={t==='new'?'tag new':'tag'}>{t}</span>)}</div></div></a>})}</div></main>}
