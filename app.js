(() => {
  "use strict";
  const SIZE = 4;
  const TARGET = 2048;
  const SAVE_KEY = "nova-merge-state-v2";
  const BEST_KEY = "nm-best";
  const $ = (id) => document.getElementById(id);
  const board = $("board");
  const tileLayer = $("tileLayer");
  const cellLayer = $("cellLayer");
  const dialog = $("dialog");
  let grid = blankGrid();
  let score = 0;
  let best = readNumber(BEST_KEY, 0);
  let moves = 0;
  let nextValue = 2;
  let tileSequence = 0;
  let undoSnapshot = null;
  let hasWon = false;
  let isEnded = false;
  let dialogKind = "";
  let tileSize = 0;
  let tileGap = 0;
  let saveTimer = 0;
  let toastTimer = 0;
  const tileNodes = new Map();

  function blankGrid() { return Array.from({ length: SIZE }, () => Array(SIZE).fill(null)); }
  function cloneGrid(sourceGrid) { return sourceGrid.map(row => row.map(tile => tile ? { id: tile.id, value: tile.value } : null)); }
  function readNumber(key, fallback) {
    try { const value = Number(localStorage.getItem(key)); return Number.isFinite(value) && value >= 0 ? value : fallback; }
    catch (_) { return fallback; }
  }
  function randomValue() { return Math.random() < 0.9 ? 2 : 4; }
  function newTile(value) { tileSequence += 1; return { id: "nova-" + tileSequence, value: value }; }
  function freeCells(sourceGrid) {
    const cells = [];
    sourceGrid.forEach((row, r) => row.forEach((tile, c) => { if (!tile) cells.push([r, c]); }));
    return cells;
  }
  function spawnTile() {
    const available = freeCells(grid);
    if (!available.length) return null;
    const point = available[Math.floor(Math.random() * available.length)];
    const tile = newTile(nextValue);
    grid[point[0]][point[1]] = tile;
    nextValue = randomValue();
    return tile.id;
  }
  function getLines(direction) {
    const lines = [];
    for (let line = 0; line < SIZE; line++) {
      const coords = [];
      for (let step = 0; step < SIZE; step++) {
        if (direction === "left") coords.push([line, step]);
        else if (direction === "right") coords.push([line, SIZE - 1 - step]);
        else if (direction === "up") coords.push([step, line]);
        else coords.push([SIZE - 1 - step, line]);
      }
      lines.push(coords);
    }
    return lines;
  }
  function moveGrid(sourceGrid, direction) {
    const next = blankGrid();
    let gained = 0;
    const mergedIds = [];
    const removedIds = [];
    getLines(direction).forEach(coords => {
      const tiles = coords.map(point => sourceGrid[point[0]][point[1]]).filter(Boolean);
      const result = [];
      for (let index = 0; index < tiles.length; index++) {
        const current = tiles[index];
        const following = tiles[index + 1];
        if (following && current.value === following.value) {
          const merged = { id: current.id, value: current.value * 2 };
          result.push(merged);
          gained += merged.value;
          mergedIds.push(merged.id);
          removedIds.push(following.id);
          index += 1;
        } else result.push(current);
      }
      coords.forEach((point, index) => { next[point[0]][point[1]] = result[index] || null; });
    });
    const changed = sourceGrid.some((row, r) => row.some((tile, c) => {
      const after = next[r][c];
      return (tile ? tile.value : 0) !== (after ? after.value : 0);
    }));
    return { grid: next, gained: changed ? gained : 0, mergedIds: mergedIds, removedIds: removedIds, changed: changed };
  }
  function canMove() {
    if (freeCells(grid).length) return true;
    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
      const value = grid[r][c].value;
      if (c + 1 < SIZE && grid[r][c + 1].value === value) return true;
      if (r + 1 < SIZE && grid[r + 1][c].value === value) return true;
    }
    return false;
  }
  function highestValue() { return Math.max(0, ...grid.flat().map(tile => tile ? tile.value : 0)); }
  function updateSaveLabel(saved) {
    $("saveLight").classList.toggle("error", !saved);
    $("saveLabel").textContent = saved ? "Saved on this device" : "Local save unavailable";
  }
  function persist() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try {
        localStorage.setItem(SAVE_KEY, JSON.stringify({ version: 2, grid: grid, score: score, best: best, moves: moves, nextValue: nextValue, tileSequence: tileSequence, hasWon: hasWon, undoSnapshot: undoSnapshot }));
        localStorage.setItem(BEST_KEY, String(best));
        updateSaveLabel(true);
      } catch (_) { updateSaveLabel(false); }
    }, 80);
  }
  function isValidGrid(value) {
    return Array.isArray(value) && value.length === SIZE && value.every(row => Array.isArray(row) && row.length === SIZE && row.every(tile => tile === null || (tile && typeof tile.id === "string" && Number.isSafeInteger(tile.value) && tile.value >= 2 && Number.isInteger(Math.log2(tile.value)))));
  }
  function restoreGame() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const saved = JSON.parse(raw);
      if (!saved || saved.version !== 2 || !isValidGrid(saved.grid)) return false;
      grid = cloneGrid(saved.grid);
      score = Number.isFinite(saved.score) && saved.score >= 0 ? saved.score : 0;
      best = Math.max(best, Number.isFinite(saved.best) && saved.best >= 0 ? saved.best : 0);
      moves = Number.isSafeInteger(saved.moves) && saved.moves >= 0 ? saved.moves : 0;
      nextValue = saved.nextValue === 4 ? 4 : 2;
      tileSequence = Number.isSafeInteger(saved.tileSequence) && saved.tileSequence >= 0 ? saved.tileSequence : 0;
      hasWon = Boolean(saved.hasWon);
      if (saved.undoSnapshot && isValidGrid(saved.undoSnapshot.grid) && Number.isFinite(saved.undoSnapshot.score)) {
        undoSnapshot = { grid: cloneGrid(saved.undoSnapshot.grid), score: saved.undoSnapshot.score, moves: Number(saved.undoSnapshot.moves) || 0, hasWon: Boolean(saved.undoSnapshot.hasWon) };
      }
      tileSequence = Math.max(tileSequence, ...grid.flat().filter(Boolean).map(tile => Number(tile.id.split("-").pop()) || 0));
      return true;
    } catch (_) { return false; }
  }
  function measureTiles() {
    const width = tileLayer.clientWidth;
    if (!width) return;
    const style = getComputedStyle(tileLayer);
    tileGap = parseFloat(style.columnGap || style.gap) || 0;
    tileSize = (width - tileGap * (SIZE - 1)) / SIZE;
  }
  function setTilePosition(node, row, col) {
    const offset = tileSize + tileGap;
    node.style.width = tileSize + "px";
    node.style.height = tileSize + "px";
    node.style.transform = "translate3d(" + (col * offset) + "px," + (row * offset) + "px,0)";
  }
  function tileLevel(value) { return Math.max(1, Math.min(14, Math.log2(value))); }
  function renderBoard(options) {
    const settings = options || {};
    const instant = Boolean(settings.instant);
    const newIds = new Set(settings.newIds || []);
    const mergedIds = new Set(settings.mergedIds || []);
    const activeIds = new Set();
    measureTiles();
    grid.forEach((row, r) => row.forEach((tile, c) => {
      if (!tile) return;
      activeIds.add(tile.id);
      let node = tileNodes.get(tile.id);
      const isNew = !node;
      if (isNew) {
        node = document.createElement("div");
        node.className = "tile";
        node.dataset.id = tile.id;
        node.style.width = tileSize + "px";
        node.style.height = tileSize + "px";
        setTilePosition(node, r, c);
        tileLayer.appendChild(node);
        tileNodes.set(tile.id, node);
      }
      node.dataset.level = String(tileLevel(tile.value));
      node.textContent = String(tile.value);
      node.setAttribute("role", "gridcell");
      node.setAttribute("aria-label", "Tile " + tile.value);
      node.setAttribute("aria-rowindex", String(r + 1));
      node.setAttribute("aria-colindex", String(c + 1));
      node.classList.toggle("tile-small", tile.value >= 10000);
      if (!isNew) setTilePosition(node, r, c);
      if (isNew && !instant) node.classList.add("tile-enter");
      if (isNew && newIds.has(tile.id)) node.classList.add("tile-enter");
      if (mergedIds.has(tile.id) && !instant) {
        node.classList.remove("tile-merge");
        void node.offsetWidth;
        node.classList.add("tile-merge");
      }
    }));
    for (const [id, node] of tileNodes) {
      if (activeIds.has(id)) continue;
      tileNodes.delete(id);
      if (instant) node.remove();
      else {
        node.classList.add("tile-exit");
        setTimeout(() => node.remove(), 140);
      }
    }
  }
  function updateUI(gain) {
    $("score").textContent = score.toLocaleString();
    $("best").textContent = best.toLocaleString();
    $("moves").textContent = moves.toLocaleString();
    $("undoBtn").disabled = !undoSnapshot;
    $("nextValue").textContent = String(nextValue);
    $("nextTileVisual").dataset.level = String(tileLevel(nextValue));
    const highest = highestValue();
    const percent = Math.min(100, Math.round(highest / TARGET * 100));
    $("highestTile").textContent = "Highest tile: " + (highest ? highest.toLocaleString() : "0");
    $("goalPercent").textContent = percent + "%";
    $("goalBar").style.width = percent + "%";
    $("goalProgress").setAttribute("aria-valuenow", String(percent));
    $("runLabel").textContent = isEnded ? "RUN COMPLETE" : hasWon ? "2048 REACHED" : "YOUR RUN";
    $("gameCenter").classList.toggle("milestone", hasWon);
    $("statusPulse").classList.toggle("over", isEnded);
    if (gain > 0) {
      const gainEl = $("scoreGain");
      gainEl.textContent = "+" + gain.toLocaleString();
      gainEl.classList.remove("show");
      void gainEl.offsetWidth;
      gainEl.classList.add("show");
    }
  }
  function announce(message) { $("announcer").textContent = ""; setTimeout(() => { $("announcer").textContent = message; }, 25); }
  function showToast(message) { const toast = $("toast"); toast.textContent = message; toast.classList.add("show"); clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove("show"), 2400); }
  async function shareScore() {
    const reached = highestValue();
    const text = "I scored " + score.toLocaleString() + " on NovaMerge and reached " + (reached ? reached.toLocaleString() : "0") + ". Can you beat me?";
    try {
      if (navigator.share) { await navigator.share({ title: "NovaMerge", text: text, url: window.location.href }); showToast("Score shared."); }
      else if (navigator.clipboard && navigator.clipboard.writeText) { await navigator.clipboard.writeText(text + " " + window.location.href); showToast("Score copied. Send it to a friend."); }
      else showToast("Share is not available in this browser.");
    } catch (error) { if (!error || error.name !== "AbortError") showToast("Could not share right now."); }
  }
  function setMessage(message) { $("boardMessage").textContent = message; }
  function play(direction) {
    if (isEnded || !dialog.hidden) return;
    const result = moveGrid(grid, direction);
    if (!result.changed) { setMessage("No change that way. Try another direction."); return; }
    undoSnapshot = { grid: cloneGrid(grid), score: score, moves: moves, hasWon: hasWon };
    grid = result.grid;
    score += result.gained;
    moves += 1;
    const spawnedId = spawnTile();
    if (score > best) best = score;
    renderBoard({ newIds: spawnedId ? [spawnedId] : [], mergedIds: result.mergedIds });
    updateUI(result.gained);
    setMessage(result.gained ? "Nice merge. Keep the chain going." : "A new tile appears. Plan your next move.");
    announce((result.gained ? "Merged tiles for " + result.gained + " points. " : "Moved tiles. ") + "Score " + score + ". " + moves + " moves.");
    persist();
    if (!hasWon && highestValue() >= TARGET) {
      hasWon = true;
      updateUI(0);
      persist();
      showDialog("win");
    } else if (!canMove()) {
      isEnded = true;
      updateUI(0);
      setMessage("No moves left. Undo your last move or start a new run.");
      persist();
      showDialog("over");
    }
  }
  function undoMove() {
    if (!undoSnapshot) return;
    const previous = undoSnapshot;
    grid = cloneGrid(previous.grid);
    score = previous.score;
    moves = previous.moves;
    hasWon = previous.hasWon;
    undoSnapshot = null;
    isEnded = false;
    renderBoard({ instant: true });
    updateUI(0);
    setMessage("Last move undone. Choose a new direction.");
    announce("Move undone. Score " + score + ".");
    closeDialog();
    persist();
    board.focus({ preventScroll: true });
  }
  function startGame() {
    grid = blankGrid();
    score = 0;
    moves = 0;
    tileSequence = 0;
    undoSnapshot = null;
    hasWon = false;
    isEnded = false;
    nextValue = randomValue();
    tileNodes.clear();
    tileLayer.replaceChildren();
    spawnTile();
    spawnTile();
    renderBoard({ instant: true });
    updateUI(0);
    setMessage("Every move matters. Take your time.");
    closeDialog();
    persist();
    board.focus({ preventScroll: true });
    announce("New game started. Use arrow keys, W A S D, or swipe to move.");
  }
  function showDialog(kind) {
    dialogKind = kind;
    const primary = $("dialogPrimary");
    const secondary = $("dialogSecondary");
    const emblem = $("dialogEmblem");
    if (kind === "new") {
      $("dialogKicker").textContent = "FRESH BOARD";
      $("dialogTitle").textContent = "Start a new run?";
      $("dialogBody").textContent = "Your current score stays in your personal best. This run will be replaced.";
      emblem.textContent = "↻";
      primary.textContent = "Start new game";
      secondary.textContent = "Keep playing";
      secondary.hidden = false;
    } else if (kind === "win") {
      $("dialogKicker").textContent = "MILESTONE REACHED";
      $("dialogTitle").textContent = "You made 2048.";
      $("dialogBody").textContent = "That is the classic goal. Your run continues—keep merging and see how far you can go.";
      emblem.textContent = "✦";
      primary.textContent = "Keep going";
      secondary.textContent = "Close";
      secondary.hidden = false;
    } else if (kind === "over") {
      $("dialogKicker").textContent = "RUN COMPLETE";
      $("dialogTitle").textContent = "The board is full.";
      $("dialogBody").textContent = "Final score: " + score.toLocaleString() + ". Undo your last move or start fresh.";
      emblem.textContent = "·";
      primary.textContent = "New run";
      secondary.textContent = undoSnapshot ? "Undo last move" : "Close";
      secondary.hidden = false;
    } else {
      $("dialogKicker").textContent = "HOW TO PLAY";
      $("dialogTitle").textContent = "Every slide counts.";
      $("dialogBody").textContent = "Use the arrow keys or W A S D, or swipe on the board. Matching tiles merge once per move. A new tile appears only after a move changes the board. Undo one move at a time. Your run and best score save in this browser.";
      emblem.textContent = "?";
      primary.textContent = "Back to the board";
      secondary.hidden = true;
    }
    dialog.hidden = false;
    setTimeout(() => primary.focus(), 30);
  }
  function closeDialog() { dialog.hidden = true; dialogKind = ""; }
  function dismissDialog() { closeDialog(); board.focus({ preventScroll: true }); }
  function handleDialogPrimary() {
    const kind = dialogKind;
    if (kind === "new" || kind === "over") startGame();
    else { closeDialog(); board.focus({ preventScroll: true }); }
  }
  function handleDialogSecondary() {
    const kind = dialogKind;
    if (kind === "over" && undoSnapshot) undoMove();
    else dismissDialog();
  }
  function requestNewGame() {
    if (moves === 0 && score === 0) startGame();
    else showDialog("new");
  }
  function setupCells() {
    const fragment = document.createDocumentFragment();
    for (let i = 0; i < SIZE * SIZE; i++) {
      const cell = document.createElement("div");
      cell.className = "cell";
      fragment.appendChild(cell);
    }
    cellLayer.appendChild(fragment);
  }
  function restoreOrStart() {
    const saved = restoreGame();
    if (saved) {
      isEnded = !canMove();
      renderBoard({ instant: true });
      updateUI(0);
      setMessage(isEnded ? "No moves left. Undo or start a new run." : "Welcome back. Your run was saved here.");
      if (isEnded) showDialog("over");
      else announce("Saved game restored. Score " + score + ".");
    } else startGame();
  }

  setupCells();
  $("undoBtn").addEventListener("click", undoMove);
  $("newGameBtn").addEventListener("click", requestNewGame);
  $("helpBtn").addEventListener("click", () => showDialog("help"));
  $("shareBtn").addEventListener("click", shareScore);
  $("dialogClose").addEventListener("click", dismissDialog);
  $("dialogPrimary").addEventListener("click", handleDialogPrimary);
  $("dialogSecondary").addEventListener("click", handleDialogSecondary);
  dialog.addEventListener("click", event => { if (event.target === dialog) dismissDialog(); });
  dialog.addEventListener("keydown", event => {
    if (event.key !== "Tab") return;
    const focusables = [$("dialogClose"), ...($("dialogSecondary").hidden ? [] : [$("dialogSecondary")]), $("dialogPrimary")];
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
  board.addEventListener("pointerdown", event => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    board.dataset.startX = String(event.clientX);
    board.dataset.startY = String(event.clientY);
    if (board.setPointerCapture) board.setPointerCapture(event.pointerId);
  });
  board.addEventListener("pointerup", event => {
    if (board.dataset.startX === undefined) return;
    const dx = event.clientX - Number(board.dataset.startX);
    const dy = event.clientY - Number(board.dataset.startY);
    delete board.dataset.startX;
    delete board.dataset.startY;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 25) return;
    play(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up"));
  });
  board.addEventListener("pointercancel", () => { delete board.dataset.startX; delete board.dataset.startY; });
  window.addEventListener("keydown", event => {
    if (!dialog.hidden) {
      if (event.key === "Escape") { dismissDialog(); event.preventDefault(); }
      return;
    }
    const target = event.target;
    if (target && target.closest && target.closest("button,a,input,textarea,select,[contenteditable=true]")) return;
    const key = event.key.toLowerCase();
    if (key === "u") { event.preventDefault(); undoMove(); return; }
    if (key === "r") { event.preventDefault(); requestNewGame(); return; }
    const map = { arrowleft: "left", a: "left", arrowright: "right", d: "right", arrowup: "up", w: "up", arrowdown: "down", s: "down" };
    if (map[key]) { event.preventDefault(); play(map[key]); }
  });
  let resizeFrame = 0;
  window.addEventListener("resize", () => {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => {
      measureTiles();
      grid.forEach((row, r) => row.forEach((tile, c) => { if (tileNodes.has(tile && tile.id)) setTilePosition(tileNodes.get(tile.id), r, c); }));
    });
  });
  document.addEventListener("visibilitychange", () => { if (document.hidden) persist(); });
  restoreOrStart();
})();