// Cờ caro (gomoku) rules. Board = flat array N*N, 0 empty, 1 = X (moves first), 2 = O.
// Win = 5 or more in a row (horizontal, vertical, diagonal). Optional Vietnamese rule 'vn': a line whose BOTH ends are
// blocked by opponent stones does not win (the board edge does not count as a block).
export const X=1,O=2,SIZES=[15,19];
export const newBoard=N=>new Array(N*N).fill(0);
export const DIRS=[[0,1],[1,0],[1,1],[1,-1]];
// b[i] must already hold the stone just played. Returns the winning cells (the whole run) or null.
export function winAt(b,N,i,rule='free'){
  const p=b[i];if(!p)return null;const r=(i/N)|0,c=i%N;
  for(const[dr,dc]of DIRS){const cells=[i];let R=r+dr,C=c+dc;
    while(R>=0&&R<N&&C>=0&&C<N&&b[R*N+C]===p){cells.push(R*N+C);R+=dr;C+=dc}
    const e1=R>=0&&R<N&&C>=0&&C<N?b[R*N+C]:-1;R=r-dr;C=c-dc;
    while(R>=0&&R<N&&C>=0&&C<N&&b[R*N+C]===p){cells.unshift(R*N+C);R-=dr;C-=dc}
    const e2=R>=0&&R<N&&C>=0&&C<N?b[R*N+C]:-1;
    if(cells.length<5)continue;
    if(rule==='vn'&&e1===3-p&&e2===3-p)continue;
    return cells}
  return null}
export const playerAt=n=>n%2===0?X:O;      // n = number of moves already played
// outcome of a move list [{i,p}] -> {win:cells|null, winner:1|2|null, draw:bool}
export function result(moves,N,rule){const b=newBoard(N);let last=null;
  for(const m of moves){b[m.i]=m.p;last=m}
  const w=last&&winAt(b,N,last.i,rule);
  return{board:b,win:w,winner:w?last.p:null,draw:!w&&moves.length>=N*N}}
