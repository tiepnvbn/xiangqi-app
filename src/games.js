// Registry of games shown on the hub. To add a game: add an entry here, an icon in Hub.jsx, and a case in Hub's router.
export const GAMES=[
  {id:'xiangqi',title:'Cờ tướng',sub:'Xiangqi · Chinese chess',desc:'Play the engine at 6 levels or a friend on the same screen, set up any position, scan a board from a photo.',tags:['vs engine','2 players','photo scan'],color:'#c0392b'},
  {id:'jieqi',title:'Cờ úp',sub:'Jieqi · hidden pieces',desc:'Every piece starts face-down and is revealed when it first moves. Pure nerve and luck.',tags:['vs engine','2 players','new'],color:'#b9803a'},
  {id:'chess',title:'Cờ vua',sub:'Chess · powered by Stockfish',desc:'Full rules, six engine levels from Beginner to full-strength Stockfish, review and PGN export.',tags:['vs engine','2 players','new'],color:'#7a8a4a'},
  {id:'caro',title:'Cờ caro',sub:'Gomoku · five in a row',desc:'Get five in a row first. Play the AI at 5 levels or a friend on the same screen.',tags:['vs AI','2 players','15×15 / 19×19'],color:'#2e86de'}];
