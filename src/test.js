import {parse,START,legal,apply,best,toFen} from './xq.js';
const {b}=parse(START);console.log('red moves at start (expect 44):',legal(b,'w').length);
let p=0;for(const m of legal(b,'w'))p+=legal(apply(b,m),'b').length;console.log('perft2 (expect 1920):',p);
console.log('fen roundtrip:',toFen(b,'w')===START);
let t=Date.now();best(b,'w',3,0);console.log('depth3 ms',Date.now()-t);t=Date.now();best(b,'w',4,0);console.log('depth4 ms',Date.now()-t);
