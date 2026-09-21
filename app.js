const SIZE = 4;
let grid, score, best = Number(localStorage.getItem('nm-best') || 0);
const boardEl = document.getElementById('board');
const scoreEl = document.getElementById('score');
const bestEl = document.getElementById('best');
const statusEl = document.getElementById('status');
bestEl.textContent = best;

function empty() { return Array.from({ length: SIZE }, () => Array(SIZE).fill(0)); }
function cells() {
  const out = [];
  grid.forEach((row, r) => row.forEach((v, c) => { if (!v) out.push([r, c]); }));
  return out;
}
function spawn() {
  const free = cells();
  if (!free.length) return;
  const [r, c] = free[Math.floor(Math.random() * free.length)];
  grid[r][c] = Math.random() < 0.9 ? 2 : 4;
}
function draw() {
  boardEl.innerHTML = grid.flat().map((v) => {
    const shade = v ? Math.min(Math.log2(v) / 11, 1) : 0;
    const bg = v ? `hsl(258 80% ${72 - shade * 34}%)` : '#1c1b27';
    const color = shade > 0.55 ? '#fff' : '#1a1028';
    return `<div class="tile" style="background:${bg};color:${color}">${v || ''}</div>`;
  }).join('');
  scoreEl.textContent = score;
  if (score > best) { best = score; localStorage.setItem('nm-best', best); bestEl.textContent = best; }
}
function slide(row) {
  const nums = row.filter(Boolean);
  const next = [];
  for (let i = 0; i < nums.length; i++) {
    if (nums[i] === nums[i + 1]) { next.push(nums[i] * 2); score += nums[i] * 2; i++; }
    else next.push(nums[i]);
  }
  while (next.length < SIZE) next.push(0);
  return next;
}
function rotate(dir) {
  let g = grid.map((r) => r.slice());
  const apply = (fn) => { g = g.map(fn); };
  if (dir === 'left') apply(slide);
  if (dir === 'right') apply((r) => slide(r.slice().reverse()).reverse());
  if (dir === 'up' || dir === 'down') {
    const t = g[0].map((_, i) => g.map((r) => r[i]));
    const s = dir === 'up' ? t.map(slide) : t.map((c) => slide(c.slice().reverse()).reverse());
    g = s[0].map((_, i) => s.map((r) => r[i]));
  }
  return g;
}
function moved(a, b) { return JSON.stringify(a) !== JSON.stringify(b); }
function canMove() {
  if (cells().length) return true;
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
    const v = grid[r][c];
    if (grid[r][c + 1] === v || (grid[r + 1] && grid[r + 1][c] === v)) return true;
  }
  return false;
}
function play(dir) {
  const next = rotate(dir);
  if (!moved(grid, next)) return;
  grid = next;
  spawn();
  draw();
  if (grid.flat().includes(2048)) statusEl.textContent = '2048. Keep going.';
  if (!canMove()) statusEl.textContent = 'No moves left.';
}
function start() {
  grid = empty(); score = 0; statusEl.textContent = '';
  spawn(); spawn(); draw();
}
document.getElementById('restart').onclick = start;
window.addEventListener('keydown', (e) => {
  const map = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };
  if (map[e.key]) { e.preventDefault(); play(map[e.key]); }
});
let x0, y0;
boardEl.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
boardEl.addEventListener('touchend', (e) => {
  const dx = e.changedTouches[0].clientX - x0;
  const dy = e.changedTouches[0].clientY - y0;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
  play(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
});
start();
