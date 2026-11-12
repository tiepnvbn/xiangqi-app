// Serverless function: image -> FEN. Uses Gemini (free tier) if GEMINI_API_KEY is set, else Claude if ANTHROPIC_API_KEY is set.
const PROMPT=`This is an image of a Xiangqi (Chinese chess) position. The board may be cropped, off-center, or surrounded by blank space or stray marks: first locate the board's grid.
The grid has 9 vertical lines (columns c=0..8, left to right) and 10 horizontal lines (rows r=0..9, top to bottom). Pieces sit on line intersections. The river (a text band) lies between rows 4 and 5. Palaces are the 3x3 areas at columns 3-5, rows 0-2 and rows 7-9. Red is normally at the bottom.
Identify every piece. Red pieces (drawn in red) are uppercase, black pieces (drawn in black) are lowercase: R/r rook 車, N/n horse 馬, B/b elephant (相 red, 象 black), A/a advisor (仕 red, 士 black), K/k general (帥 red, 將 black), C/c cannon (炮 red, 砲 black), P/p soldier (兵 red, 卒 black). Both generals must be inside a palace.
Return ONLY JSON like {"pieces":[{"p":"K","r":9,"c":4},{"p":"k","r":0,"c":4}],"turn":"w"} where turn is "w" if Red is to move or unknown, "b" if Black.`;
function toFen(t){
  let o;try{o=JSON.parse((t.match(/\{[\s\S]*\}/)||[''])[0])}catch{return null}
  const g=Array.from({length:10},()=>Array(9).fill('')),ok=(v,n)=>Number.isInteger(v)&&v>=0&&v<n;let n=0;
  for(const x of o.pieces||[])if(/^[rnbakcpRNBAKCP]$/.test(x.p)&&ok(x.r,10)&&ok(x.c,9)){g[x.r][x.c]=x.p;n++}
  if(!n)return null;
  return g.map(row=>{let s='',k=0;for(const p of row){if(p){if(k)s+=k;k=0;s+=p}else k++}return s+(k||'')}).join('/')+' '+(o.turn==='b'?'b':'w');
}
const GEMINI_MODELS=[process.env.GEMINI_MODEL,'gemini-3.8-flash','gemini-3.5-flash-lite','gemini-3-flash-preview'].filter(Boolean);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function gemini(image){
  let err='Gemini did not respond. Please try again.',think=true;const t0=Date.now();
  for(const model of GEMINI_MODELS){
    for(let attempt=0;attempt<2;attempt++){
      if(Date.now()-t0>30000)throw new Error(err);            // overall budget
      const gc={temperature:0,maxOutputTokens:2000,responseMimeType:'application/json'};
      if(think)gc.thinkingConfig={thinkingLevel:'low'};        // less "thinking" = much faster
      let r,j;
      try{
        r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,{method:'POST',signal:AbortSignal.timeout(25000),
          headers:{'content-type':'application/json','x-goog-api-key':process.env.GEMINI_API_KEY},
          body:JSON.stringify({contents:[{parts:[{inline_data:{mime_type:'image/jpeg',data:image}},{text:PROMPT}]}],generationConfig:gc})});
        j=await r.json().catch(()=>({}));
      }catch(e){err='Gemini took too long to respond. Please try again.';break}  // timeout -> next model
      if(r.ok)return (j.candidates?.[0]?.content?.parts||[]).map(p=>p.text||'').join('');
      const m=j.error?.message||'Gemini error '+r.status;
      if(think&&r.status===400&&/thinking/i.test(m)){think=false;attempt--;continue}   // model rejects the setting: retry without it
      const busy=r.status===503||r.status===500||r.status===529||/high demand|overloaded|unavailable/i.test(m);
      err=r.status===429?'Gemini free-tier rate limit reached. Try again in a minute.':busy?'Gemini is busy right now. Please try again in a moment.':m;
      if(busy&&attempt===0){await sleep(800);continue}
      if(busy||r.status===404||r.status===429||/no longer available|not found|not supported/i.test(m))break;
      throw new Error(m);
    }
  }
  throw new Error(err);
}
async function claude(image){
  const r=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',
    headers:{'content-type':'application/json','x-api-key':process.env.ANTHROPIC_API_KEY,'anthropic-version':'2023-06-01'},
    body:JSON.stringify({model:process.env.ANTHROPIC_MODEL||'claude-sonnet-5-5',max_tokens:300,messages:[{role:'user',content:[
      {type:'image',source:{type:'base64',media_type:'image/jpeg',data:image}},{type:'text',text:PROMPT}]}]})});
  const j=await r.json();if(!r.ok)throw new Error(j.error?.message||'Claude error '+r.status);
  return j.content?.[0]?.text||'';
}
export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'POST only'});
  const{image}=req.body||{};if(!image)return res.status(400).json({error:'no image'});
  const run=process.env.GEMINI_API_KEY?gemini:process.env.ANTHROPIC_API_KEY?claude:null;
  if(!run)return res.status(500).json({error:'No API key set on the server. Add GEMINI_API_KEY (free) in your environment variables and redeploy.'});
  try{const t=await run(image);
    const fen=toFen(t);
    if(!fen)return res.status(422).json({error:'Could not read a position from this image'});
    res.json({fen});
  }catch(e){res.status(500).json({error:e.message})}}
