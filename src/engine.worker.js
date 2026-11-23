// Runs the engine off the main thread. To use Pikafish WASM instead, replace this worker with a UCI adapter (see README).
import {think} from './engine.js';
import {thinkUp} from './jieqiAI.js';
onmessage=({data})=>{const{id,variant}=data;
  if(variant==='up'){const r=thinkUp(data);postMessage({id,move:r&&r.move,info:r&&{depth:r.dets,ms:r.ms,dets:r.dets}});return}
  const{b,turn,timeline,level}=data;const r=think({b,turn,timeline,level});postMessage({id,move:r&&r.move,info:r&&{depth:r.depth,ms:r.ms}})};
