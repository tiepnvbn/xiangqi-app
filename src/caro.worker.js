import {thinkCaro} from './caroAI.js';
onmessage=({data})=>{const r=thinkCaro(data);postMessage({id:data.id,move:r&&r.move,info:r&&{depth:r.depth,ms:r.ms}})};
