// Fallback alpha-beta engine. To use Pikafish WASM instead, replace this worker with a UCI adapter (see README).
import {best} from './xq.js';
onmessage=({data:{id,b,side,depth,noise}})=>postMessage({id,move:best(b,side,depth,noise)});
