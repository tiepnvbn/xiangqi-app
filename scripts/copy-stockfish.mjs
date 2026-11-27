// Copies the single-threaded "lite" Stockfish engine (JS + WASM, ~1.9 MB) from node_modules into public/stockfish so it is served as a static file.
import {mkdirSync,copyFileSync,existsSync} from 'node:fs';
const from='node_modules/stockfish/bin/',to='public/stockfish/';
mkdirSync(to,{recursive:true});
for(const f of['stockfish-19-lite-single.js','stockfish-19-lite-single.wasm']){if(!existsSync(from+f)){console.error('missing '+from+f+' (run npm install)');process.exit(1)}copyFileSync(from+f,to+f)}
copyFileSync('node_modules/stockfish/Copying.txt',to+'COPYING-GPL-3.0.txt');
console.log('stockfish copied to',to);
