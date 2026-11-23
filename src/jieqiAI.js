// AI for cờ úp. It never looks at hidden identities: it only knows WHICH identities are still face-down for each side (public information),
// deals them out at random over the face-down squares ("determinization"), searches each deal with the normal engine under the loose
// cờ úp movement rules, and plays the move with the best average score. More deals + more depth = stronger.
import {scoreMoves} from './engine.js';
import {legalUp,determinize,applyUp,keyUp} from './jieqi.js';

export const UP_LEVELS=[
  {depth:1,dets:1,noise:200,ms:300},
  {depth:2,dets:3,noise:60,ms:600},
  {depth:3,dets:6,noise:0,ms:1200},
  {depth:4,dets:12,noise:0,ms:2500},
  {depth:5,dets:24,noise:0,ms:5000},
  {depth:6,dets:48,noise:0,ms:10000}];

// req: {b,hid,turn,keys:[keyUp strings of earlier positions],level,rng?}
export function thinkUp(req){
  const cfg=UP_LEVELS[Math.max(0,Math.min(UP_LEVELS.length-1,req.level|0))],rng=req.rng||Math.random,t0=Date.now();
  const L=legalUp(req.b,req.hid,req.turn);if(!L.length)return null;if(L.length===1)return{move:L[0],dets:0,ms:0};
  const sum=new Array(L.length).fill(0);let n=0;
  while(n<cfg.dets){
    const nb=determinize(req.b,req.hid,rng),sc=scoreMoves({b:nb,turn:req.turn,moves:L,depth:cfg.depth});
    for(let i=0;i<L.length;i++)sum[i]+=sc[i];n++;
    if(Date.now()-t0>cfg.ms)break}
  const seen=new Set(req.keys||[]),next=req.turn==='w'?'b':'w';
  let best=0,bs=-Infinity;
  L.forEach((m,i)=>{let s=sum[i]/n;
    const r=applyUp(req.b,req.hid,m);if(seen.has(keyUp(r.b,r.hid,next)))s-=40;   // do not shuffle back and forth
    if(cfg.noise)s+=(rng()-.5)*2*cfg.noise;
    if(s>bs){bs=s;best=i}});
  return{move:L[best],dets:n,ms:Date.now()-t0,score:bs}}
