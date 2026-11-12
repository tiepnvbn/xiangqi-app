// Serverless function: image -> FEN. Uses Gemini (free tier) if GEMINI_API_KEY is set, else Claude if ANTHROPIC_API_KEY is set.
const PROMPT=`This is a photo/screenshot of a Xiangqi (Chinese chess) position. Return ONLY its FEN, no other text.
Rules: 10 ranks separated by '/', from Black's back rank (top) to Red's back rank (bottom); digits = empty points.
Red (uppercase): R rook 車, N horse 馬, B elephant 相, A advisor 仕, K general 帥, C cannon 炮, P soldier 兵.
Black (lowercase): r 車, n 馬, b 象, a 士, k 將, c 砲, p 卒. Then a space and w (Red to move) or b. Example start: rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w`;
const GEMINI_MODELS=[process.env.GEMINI_MODEL,'gemini-3.8-flash','gemini-3.5-flash-lite','gemini-3-flash-preview'].filter(Boolean);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function gemini(image){
  let err;
  for(const model of GEMINI_MODELS){
    for(let attempt=0;attempt<2;attempt++){
      const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,{method:'POST',
        headers:{'content-type':'application/json','x-goog-api-key':process.env.GEMINI_API_KEY},
        body:JSON.stringify({contents:[{parts:[{inline_data:{mime_type:'image/jpeg',data:image}},{text:PROMPT}]}],generationConfig:{temperature:0,maxOutputTokens:2000}})});
      const j=await r.json().catch(()=>({}));
      if(r.ok)return (j.candidates?.[0]?.content?.parts||[]).map(p=>p.text||'').join('');
      const m=j.error?.message||'Gemini error '+r.status;
      const busy=r.status===503||r.status===500||r.status===529||/high demand|overloaded|unavailable/i.test(m);
      err=r.status===429?'Gemini free-tier rate limit reached. Try again in a minute.':busy?'Gemini is busy right now. Please try again in a moment.':m;
      if(busy&&attempt===0){await sleep(800);continue}   // one quick retry on the same model
      if(busy||r.status===404||r.status===429||/no longer available|not found|not supported/i.test(m))break; // next model
      throw new Error(m);                                  // real error (bad key, bad request...)
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
    const m=t.match(/(?:[rnbakcpRNBAKCP1-9]+\/){9}[rnbakcpRNBAKCP1-9]+(?:\s+[wb])?/);
    if(!m)return res.status(422).json({error:'Could not read a position from this image'});
    res.json({fen:m[0].includes(' ')?m[0]:m[0]+' w'});
  }catch(e){res.status(500).json({error:e.message})}}
