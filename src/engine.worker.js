// Runs the engine off the main thread. To use Pikafish WASM instead, replace this worker with a UCI adapter (see README).
import {think} from './engine.js';
onmessage=({data:{id,b,turn,timeline,level}})=>{const r=think({b,turn,timeline,level});postMessage({id,move:r&&r.move,info:r&&{depth:r.depth,ms:r.ms}})};
