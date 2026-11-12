// Vercel serverless function: image -> FEN via Claude vision. Set ANTHROPIC_API_KEY in Vercel env vars.
const PROMPT=`This is a photo/screenshot of a Xiangqi (Chinese chess) position. Return ONLY its FEN, no other text.
Rules: 10 ranks separated by '/', from Black's back rank (top) to Red's back rank (bottom); digits = empty points.
Red (uppercase): R rook 車, N horse 馬, B elephant 相, A advisor 仕, K general 帥, C cannon 炮, P soldier 兵.
Black (lowercase): r 車, n 馬, b 象, a 士, k 將, c 砲, p 卒. Then a space and w (Red to move) or b. Example start: rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w`;
export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'POST only'});
  const{image}=req.body||{};if(!image)return res.status(400).json({error:'no image'});
  try{const r=await fetch('https://api.anthropic.com/v1/messages',{method:'POST',
    headers:{'content-type':'application/json','x-api-key':process.env.ANTHROPIC_API_KEY,'anthropic-version':'2023-06-01'},
    body:JSON.stringify({model:process.env.ANTHROPIC_MODEL||'claude-sonnet-5-5',max_tokens:300,messages:[{role:'user',content:[
      {type:'image',source:{type:'base64',media_type:'image/jpeg',data:image}},{type:'text',text:PROMPT}]}]})});
    const j=await r.json();const t=j.content?.[0]?.text||'';
    const m=t.match(/(?:[rnbakcpRNBAKCP1-9]+\/){9}[rnbakcpRNBAKCP1-9]+(?:\s+[wb])?/);
    if(!m)return res.status(422).json({error:j.error?.message||'Could not read a position'});
    res.json({fen:m[0].includes(' ')?m[0]:m[0]+' w'});
  }catch(e){res.status(500).json({error:e.message})}}
