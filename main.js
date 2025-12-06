let canvas;
let ctx;
let statusEl;
let buttons;

const tileSize = 32;
const gridWidth = 25;
const gridHeight = 18;

const directions = [
  { x: 1, y: 0, name: 'right', angle: 0 },
  { x: 0, y: 1, name: 'down', angle: Math.PI / 2 },
  { x: -1, y: 0, name: 'left', angle: Math.PI },
  { x: 0, y: -1, name: 'up', angle: -Math.PI / 2 }
];

const colors = {
  grass: '#0e1820',
  iron: '#243749',
  copper: '#3f2a1d',
  belt: '#304b63',
  miner: '#4c7a3f',
  assembler: '#693f7a',
  hub: '#c9a63b',
  outline: '#0b1016'
};

function createState() {
  return {
    world: [],
    structures: new Map(),
    looseItems: [],
    selected: 'belt',
    rotation: 0,
    hovered: null,
    paused: false,
    score: 0,
    ticks: 0,
    lastPlacement: null
  };
}

const state = createState();

function key(x, y) {
  return `${x},${y}`;
}

function inBounds(x, y) {
  return x >= 0 && y >= 0 && x < gridWidth && y < gridHeight;
}

function genWorld(targetState = state) {
  targetState.world = [];
  for (let y = 0; y < gridHeight; y++) {
    const row = [];
    for (let x = 0; x < gridWidth; x++) {
      row.push({ type: 'grass', resource: null });
    }
    targetState.world.push(row);
  }

  // Sprinkle resources
  seedResource('iron', 5, 9, 4, targetState);
  seedResource('iron', 16, 6, 3, targetState);
  seedResource('copper', 9, 12, 4, targetState);
  seedResource('copper', 19, 10, 3, targetState);
}

function seedResource(type, cx, cy, r, targetState = state) {
  for (let y = -r; y <= r; y++) {
    for (let x = -r; x <= r; x++) {
      const px = cx + x;
      const py = cy + y;
      if (!inBounds(px, py)) continue;
      const dist = Math.sqrt(x * x + y * y);
      if (dist <= r + Math.random() * 0.5) {
        targetState.world[py][px] = { type: 'grass', resource: { type, amount: 9999 } };
      }
    }
  }
}

function setSelected(tool) {
  state.selected = tool;
  if (buttons) {
    buttons.forEach((b) => b.classList.toggle('active', b.dataset.tool === tool));
  }
}

function initializeGame(doc = document) {
  canvas = doc.getElementById('game');
  if (!canvas) return;
  ctx = canvas.getContext('2d');
  statusEl = doc.getElementById('status');
  buttons = doc.querySelectorAll('.controls button[data-tool]');

  const pauseBtn = doc.getElementById('pause-btn');
  const resetBtn = doc.getElementById('reset-btn');

  if (pauseBtn) {
    pauseBtn.addEventListener('click', togglePause);
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', resetGame);
  }

  buttons.forEach((btn) => {
    btn.addEventListener('click', () => setSelected(btn.dataset.tool));
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'r' || e.key === 'R') {
      state.rotation = (state.rotation + 1) % directions.length;
    }
    if (e.key === ' ' || e.key === 'p' || e.key === 'P') {
      togglePause();
    }
    if (e.key === 'n' || e.key === 'N') {
      resetGame();
    }
    if (e.key === 'b' || e.key === 'B') setSelected('belt');
    if (e.key === 'm' || e.key === 'M') setSelected('miner');
    if (e.key === 's' || e.key === 'S') setSelected('smelter');
    if (e.key === 'a' || e.key === 'A') setSelected('assembler');
    if (e.key === 'h' || e.key === 'H') setSelected('hub');
    if (e.key === 'x' || e.key === 'X') setSelected('remove');
  });

  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / tileSize);
    const y = Math.floor((e.clientY - rect.top) / tileSize);
    state.hovered = inBounds(x, y) ? { x, y } : null;
  });

  canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / tileSize);
    const y = Math.floor((e.clientY - rect.top) / tileSize);
    if (!inBounds(x, y)) return;

    if (state.selected === 'remove') {
      removeStructure(x, y);
      return;
    }

    placeStructure(x, y, state.selected, state.rotation);
  });

  genWorld(state);
  setSelected('belt');
  lastTime = performance.now();
  requestAnimationFrame(loop);
}

function structureAt(x, y) {
  return state.structures.get(key(x, y));
}

function placeStructure(x, y, type, rotation) {
  if (!canPlace(x, y, type)) return;
  const existing = structureAt(x, y);
  if (existing && type !== 'belt') return;

  if (type === 'belt') {
    const belt = { type: 'belt', dir: rotation, items: [] };
    state.structures.set(key(x, y), belt);
  } else if (type === 'miner') {
    const tile = state.world[y][x];
    if (!tile.resource) return;
    state.structures.set(key(x, y), { type: 'miner', dir: rotation, progress: 0 });
  } else if (type === 'smelter') {
    state.structures.set(key(x, y), { type: 'smelter', dir: rotation, progress: 0, input: [], crafting: false, smelting: null });
  } else if (type === 'assembler') {
    state.structures.set(key(x, y), { type: 'assembler', dir: rotation, progress: 0, input: [], crafting: false });
  } else if (type === 'hub') {
    state.structures.set(key(x, y), { type: 'hub' });
  }
  state.lastPlacement = { x, y };
}

function removeStructure(x, y) {
  const structure = structureAt(x, y);
  if (structure) {
    state.structures.delete(key(x, y));
  }
}

function addItemToBelt(belt, item) {
  if (belt.items.length >= 3) return false;
  belt.items.push({ ...item, progress: 0 });
  return true;
}

function addLooseItem(x, y, item) {
  state.looseItems.push({ x: x + 0.5, y: y + 0.5, item, drift: Math.random() * Math.PI * 2 });
}

function update(dt) {
  if (state.paused) {
    if (statusEl) {
      statusEl.textContent = `Paused | Selected: ${state.selected} | Rotation: ${directions[state.rotation].name}`;
    }
    return;
  }
  state.ticks++;
  updateMiners(dt);
  updateSmelters(dt);
  updateAssemblers(dt);
  updateBelts(dt);
  updateLoose(dt);
  if (statusEl) {
    statusEl.textContent = `Score: ${state.score} | Selected: ${state.selected} | Rotation: ${directions[state.rotation].name}`;
  }
}

function updateMiners(dt) {
  const speed = 2.4; // items per 10 seconds roughly
  state.structures.forEach((structure, pos) => {
    if (structure.type !== 'miner') return;
    structure.progress += dt * speed;
    if (structure.progress >= 1) {
      structure.progress = 0;
      const [x, y] = pos.split(',').map(Number);
      const tile = state.world[y][x];
      if (tile.resource && tile.resource.amount > 0) {
        const out = moveForward(x, y, structure.dir);
        const item = { type: tile.resource.type };
        const target = structureAt(out.x, out.y);
        deliverOutput(item, target, out);
      }
    }
  });
}

function updateSmelters(dt) {
  const craftTime = 2.2;
  state.structures.forEach((structure, pos) => {
    if (structure.type !== 'smelter') return;
    if (structure.crafting) {
      structure.progress += dt;
      if (structure.progress >= craftTime) {
        structure.progress = 0;
        structure.crafting = false;
        const [x, y] = pos.split(',').map(Number);
        const out = moveForward(x, y, structure.dir);
        const target = structureAt(out.x, out.y);
        const plateType = `${structure.smelting}-plate`;
        const item = { type: plateType };
        deliverOutput(item, target, out);
        structure.smelting = null;
      }
      return;
    }

    const oreIndex = structure.input.findIndex((i) => i.type === 'iron' || i.type === 'copper');
    if (oreIndex !== -1) {
      const [ore] = structure.input.splice(oreIndex, 1);
      structure.crafting = true;
      structure.progress = 0;
      structure.smelting = ore.type;
        const target = structureAt(out.x, out.y);
        const item = { type: tile.resource.type };
        if (target && target.type === 'belt') {
          if (!addItemToBelt(target, item)) {
            addLooseItem(out.x, out.y, item);
          }
        } else {
          addLooseItem(out.x, out.y, item);
        }
      }
    }
  });
}

function updateAssemblers(dt) {
  const craftTime = 3.5;
  state.structures.forEach((structure, pos) => {
    if (structure.type !== 'assembler') return;
    if (structure.crafting) {
      structure.progress += dt;
      if (structure.progress >= craftTime) {
        structure.progress = 0;
        structure.crafting = false;
        const [x, y] = pos.split(',').map(Number);
        const out = moveForward(x, y, structure.dir);
        const item = { type: 'gear' };
        const target = structureAt(out.x, out.y);
        deliverOutput(item, target, out);
      }
      return;
    }

    let removed = 0;
    structure.input = structure.input.filter((i) => {
      if (i.type === 'iron-plate' && removed < 2) {
      if (i.type === 'iron' && removed < 2) {
        removed += 1;
        return false;
      }
      return true;
    });

    if (removed >= 2) {
      structure.crafting = true;
      structure.progress = 0;
    }
  });
}

function scoreItem(type) {
  if (type === 'gear') return 10;
  if (type === 'iron-plate') return 3;
  if (type === 'copper-plate') return 2;
  return 1;
}

function deliverOutput(item, target, dest) {
  if (target && target.type === 'belt') {
    if (!addItemToBelt(target, item)) {
      addLooseItem(dest.x, dest.y, item);
    }
  } else if (target && (target.type === 'assembler' || target.type === 'smelter')) {
    target.input.push(item);
  } else if (target && target.type === 'hub') {
    state.score += scoreItem(item.type);
  } else if (inBounds(dest.x, dest.y)) {
    addLooseItem(dest.x, dest.y, item);
  }
}

function updateBelts(dt) {
  const speed = 2.5;
  const transfers = [];

  state.structures.forEach((structure, pos) => {
    if (structure.type !== 'belt') return;
    structure.items.forEach((item) => (item.progress += dt * speed));
    const [x, y] = pos.split(',').map(Number);
    const forward = moveForward(x, y, structure.dir);
    const targetStructure = structureAt(forward.x, forward.y);
    const ready = structure.items.filter((i) => i.progress >= 1);
    if (!ready.length) return;

    ready.forEach((item) => {
      const transfer = { item: { type: item.type }, from: structure, to: targetStructure, dest: forward, originBelt: structure };
      transfers.push(transfer);
    });

    structure.items = structure.items.filter((i) => i.progress < 1);
  });

  transfers.forEach((transfer) => {
    const { item, to, dest, originBelt } = transfer;
    if (to && to.type === 'belt') {
      const success = addItemToBelt(to, item);
      if (!success) {
        originBelt.items.push({ ...item, progress: 0.95 });
      }
      return;
    }

    deliverOutput(item, to, dest);
  });
}

function updateLoose(dt) {
  for (let i = state.looseItems.length - 1; i >= 0; i--) {
    const item = state.looseItems[i];
    item.drift += dt * 0.5;
    item.x += Math.cos(item.drift) * dt * 0.05;
    item.y += Math.sin(item.drift) * dt * 0.05;
    if (Math.random() < 0.0005) {
      state.looseItems.splice(i, 1);
    }
  }
}

function moveForward(x, y, dirIndex) {
  const dir = directions[dirIndex];
  return { x: x + dir.x, y: y + dir.y };
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawTiles();
  drawStructures();
  drawItems();
  drawHover();
  drawLastPlacement();
  if (state.paused) drawPauseOverlay();
}

function drawTiles() {
  for (let y = 0; y < gridHeight; y++) {
    for (let x = 0; x < gridWidth; x++) {
      const tile = state.world[y][x];
      ctx.fillStyle = colors.grass;
      ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
      ctx.strokeStyle = colors.outline;
      ctx.strokeRect(x * tileSize, y * tileSize, tileSize, tileSize);
      if (tile.resource) {
        ctx.fillStyle = tile.resource.type === 'iron' ? colors.iron : colors.copper;
        ctx.fillRect(x * tileSize + 3, y * tileSize + 3, tileSize - 6, tileSize - 6);
        ctx.fillStyle = 'rgba(255,255,255,0.07)';
        ctx.fillRect(x * tileSize + 6, y * tileSize + 6, tileSize - 12, tileSize - 12);
      }
    }
  }
}

function drawStructures() {
  state.structures.forEach((structure, pos) => {
    const [x, y] = pos.split(',').map(Number);
    if (structure.type === 'belt') drawBelt(x, y, structure.dir, structure.items);
    if (structure.type === 'miner') drawMiner(x, y, structure.dir, structure.progress);
    if (structure.type === 'smelter') drawSmelter(x, y, structure.dir, structure.progress, structure.crafting);
    if (structure.type === 'assembler') drawAssembler(x, y, structure.dir, structure.progress, structure.crafting);
    if (structure.type === 'hub') drawHub(x, y);
  });
}

function drawBelt(x, y, dirIndex, items) {
  ctx.fillStyle = colors.belt;
  ctx.fillRect(x * tileSize + 4, y * tileSize + 4, tileSize - 8, tileSize - 8);
  ctx.save();
  ctx.translate((x + 0.5) * tileSize, (y + 0.5) * tileSize);
  ctx.rotate(directions[dirIndex].angle);
  ctx.fillStyle = '#79c7ff';
  ctx.beginPath();
  ctx.moveTo(-10, -6);
  ctx.lineTo(10, 0);
  ctx.lineTo(-10, 6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  items.forEach((item) => {
    const dir = directions[dirIndex];
    const px = (x + 0.5 + dir.x * (item.progress - 0.5)) * tileSize;
    const py = (y + 0.5 + dir.y * (item.progress - 0.5)) * tileSize;
    drawItem(px, py, item.type);
  });
}

function drawMiner(x, y, dirIndex, progress) {
  ctx.fillStyle = colors.miner;
  ctx.fillRect(x * tileSize + 2, y * tileSize + 2, tileSize - 4, tileSize - 4);
  ctx.strokeStyle = '#203d27';
  ctx.strokeRect(x * tileSize + 2, y * tileSize + 2, tileSize - 4, tileSize - 4);
  const bar = Math.min(progress, 1);
  ctx.fillStyle = '#9ce686';
  ctx.fillRect(x * tileSize + 6, y * tileSize + tileSize - 8, (tileSize - 12) * bar, 4);
  drawDirectionArrow(x, y, dirIndex, '#c7ffae');
}

function drawSmelter(x, y, dirIndex, progress, crafting) {
  ctx.fillStyle = colors.smelter;
  ctx.fillRect(x * tileSize + 2, y * tileSize + 2, tileSize - 4, tileSize - 4);
  ctx.fillStyle = '#5b281a';
  ctx.fillRect(x * tileSize + 5, y * tileSize + 5, tileSize - 10, tileSize - 10);
  drawDirectionArrow(x, y, dirIndex, '#ffc298');
  if (crafting) {
    ctx.fillStyle = '#ffb870';
    ctx.fillRect(x * tileSize + 6, y * tileSize + tileSize - 8, (tileSize - 12) * Math.min(progress / 2.2, 1), 4);
  }
}

function drawAssembler(x, y, dirIndex, progress, crafting) {
  ctx.fillStyle = colors.assembler;
  ctx.fillRect(x * tileSize + 1, y * tileSize + 1, tileSize - 2, tileSize - 2);
  ctx.fillStyle = '#4d2858';
  ctx.fillRect(x * tileSize + 6, y * tileSize + 6, tileSize - 12, tileSize - 12);
  drawDirectionArrow(x, y, dirIndex, '#e5b5ff');
  if (crafting) {
    ctx.fillStyle = '#ffd166';
    ctx.fillRect(x * tileSize + 6, y * tileSize + tileSize - 8, (tileSize - 12) * Math.min(progress / 3.5, 1), 4);
  }
}

function drawHub(x, y) {
  ctx.fillStyle = colors.hub;
  ctx.beginPath();
  ctx.arc((x + 0.5) * tileSize, (y + 0.5) * tileSize, tileSize * 0.35, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#7c5b16';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#fff0b8';
  ctx.font = 'bold 14px Inter';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('H', (x + 0.5) * tileSize, (y + 0.5) * tileSize);
}

function drawDirectionArrow(x, y, dirIndex, color) {
  ctx.save();
  ctx.translate((x + 0.5) * tileSize, (y + 0.5) * tileSize);
  ctx.rotate(directions[dirIndex].angle);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-10, -6);
  ctx.lineTo(10, 0);
  ctx.lineTo(-10, 6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawItems() {
  state.looseItems.forEach((item) => {
    drawItem(item.x * tileSize, item.y * tileSize, item.item.type, 5);
  });
}

function drawItem(px, py, type, radius = 6) {
  if (type === 'iron') ctx.fillStyle = '#a1c4ff';
  else if (type === 'copper') ctx.fillStyle = '#f7ae7b';
  else if (type === 'iron-plate') ctx.fillStyle = '#d6e8ff';
  else if (type === 'copper-plate') ctx.fillStyle = '#ffcf9f';
  else ctx.fillStyle = '#ffe37d';
  ctx.beginPath();
  ctx.arc(px, py, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawHover() {
  if (!state.hovered) return;
  const { x, y } = state.hovered;
  ctx.strokeStyle = '#31d6ff';
  ctx.lineWidth = 2;
  ctx.strokeRect(x * tileSize + 2, y * tileSize + 2, tileSize - 4, tileSize - 4);

  const valid = canPlace(x, y, state.selected);
  ctx.strokeStyle = valid ? 'rgba(49,214,255,0.7)' : 'rgba(255,82,82,0.8)';
  ctx.lineWidth = 3;
  ctx.strokeRect(x * tileSize + 5, y * tileSize + 5, tileSize - 10, tileSize - 10);

  if (state.selected !== 'remove') {
    drawDirectionArrow(x, y, state.rotation, valid ? '#31d6ff' : '#ff5252');
  }
}

function drawLastPlacement() {
  if (!state.lastPlacement) return;
  const { x, y } = state.lastPlacement;
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.setLineDash([6, 6]);
  ctx.strokeRect(x * tileSize + 1, y * tileSize + 1, tileSize - 2, tileSize - 2);
  ctx.setLineDash([]);
}

let lastTime = 0;
function loop(now) {
  const dt = Math.min(0.1, (now - lastTime) / 1000);
  lastTime = now;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

function togglePause() {
  state.paused = !state.paused;
  const pauseBtn = typeof document !== 'undefined' ? document.getElementById('pause-btn') : null;
  if (pauseBtn) {
    pauseBtn.textContent = state.paused ? 'Resume (Space/P)' : 'Pause (Space/P)';
  }
}

function resetGame() {
  const fresh = createState();
  Object.assign(state, fresh);
  state.structures = new Map();
  state.looseItems = [];
  genWorld(state);
  setSelected('belt');
  state.paused = false;
  const pauseBtn = typeof document !== 'undefined' ? document.getElementById('pause-btn') : null;
  if (pauseBtn) {
    pauseBtn.textContent = 'Pause (Space/P)';
  }
}

function canPlace(x, y, type) {
  if (!inBounds(x, y)) return false;
  const existing = structureAt(x, y);
  if (type === 'remove') return !!existing;
  if (type === 'miner') {
    return state.world?.[y]?.[x]?.resource != null;
  }
  if (existing && type !== 'belt') return false;
  return true;
}

function drawPauseOverlay() {
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#e6f6ff';
  ctx.font = 'bold 28px Orbitron, Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('PAUSED', canvas.width / 2, canvas.height / 2 - 10);
  ctx.font = '14px Inter, sans-serif';
  ctx.fillStyle = '#c7d7e9';
  ctx.fillText('Press Space/P to resume or N to regenerate the map', canvas.width / 2, canvas.height / 2 + 18);
}

if (typeof document !== 'undefined' && typeof window !== 'undefined' && !window.__FACTORY_TEST__) {
  initializeGame();
}

if (typeof module !== 'undefined') {
  module.exports = {
    key,
    inBounds,
    moveForward,
    addItemToBelt,
    deliverOutput,
    createState,
    genWorld,
    seedResource,
    colors,
    directions,
    tileSize,
    gridWidth,
    gridHeight,
    state,
    togglePause,
    resetGame,
    canPlace,
    updateSmelters,
    updateAssemblers
  };
}
