# CLAUDE.md — Factory Game

A Factorio-inspired browser automation game built with plain JavaScript and Canvas 2D.

---

## Repository Overview

```
factory-game/
├── index.html        # HTML entry point — canvas, HUD buttons, tips
├── main.js           # Entire game implementation (~638 lines)
├── main.test.js      # Jest test suite (~144 lines)
├── style.css         # Dark-theme UI styling
├── package.json      # npm metadata; only devDependency is jest
├── AGENTS.md         # Aspirational architecture documentation (not yet implemented)
└── .gitignore        # Ignores node_modules, coverage
```

**No build system.** The game runs directly in the browser by loading `main.js` as a plain `<script>`. No TypeScript, no bundler, no transpilation.

---

## Running the Game

Open `index.html` in a browser — no server required.

## Running Tests

```bash
npm install   # installs jest (first time only)
npm test      # runs jest
```

Tests use Jest and import helpers from `main.js` via CommonJS `require()`.

---

## Architecture

### Single-file Design

All game logic lives in `main.js`. There are no modules, no classes, and no build step. The file is organized top-to-bottom:

1. **DOM handles** — `canvas`, `ctx`, `statusEl`, `buttons`
2. **Constants** — `tileSize` (32px), `gridWidth` (25), `gridHeight` (18), `directions`, `colors`
3. **State** — `createState()` factory + singleton `state` object
4. **Utilities** — `key()`, `inBounds()`, `moveForward()`
5. **World generation** — `genWorld()`, `seedResource()`
6. **Update systems** — `update()`, `updateMiners()`, `updateSmelters()`, `updateAssemblers()`, `updateBelts()`, `updateLoose()`
7. **Render pipeline** — `draw()`, `drawTiles()`, `drawStructures()`, `drawItems()`, `drawHover()`, etc.
8. **Input & UI** — `initializeGame()`, keyboard/mouse handlers, `setSelected()`, `togglePause()`, `resetGame()`
9. **CommonJS exports** — exported only when `typeof module !== 'undefined'` (for Jest)

### State Object

```js
{
  world: Tile[][],           // 2D array [y][x], each tile: { type: 'grass', resource: null | { type, amount } }
  structures: Map<string, Structure>,  // key format: "x,y"
  looseItems: LooseItem[],   // items scattered on the ground
  selected: string,          // active tool: 'belt'|'miner'|'smelter'|'assembler'|'hub'|'remove'
  rotation: number,          // 0–3 index into directions[]
  hovered: {x, y} | null,   // tile under mouse cursor
  paused: boolean,
  score: number,
  ticks: number,
  lastPlacement: {x, y} | null
}
```

### Directions

```js
directions = [
  { x: 1,  y: 0,  name: 'right', angle: 0 },          // index 0
  { x: 0,  y: 1,  name: 'down',  angle: Math.PI/2 },  // index 1
  { x: -1, y: 0,  name: 'left',  angle: Math.PI },     // index 2
  { x: 0,  y: -1, name: 'up',    angle: -Math.PI/2 }  // index 3
]
```

Structures store `dir` as a number index (0–3), not a string.

### Structure Types

| Type | Fields |
|------|--------|
| `belt` | `{ type, dir, items: [] }` |
| `miner` | `{ type, dir, progress }` |
| `smelter` | `{ type, dir, progress, input: [], crafting, smelting }` |
| `assembler` | `{ type, dir, progress, input: [], crafting }` |
| `hub` | `{ type }` |

### Production Chain

```
iron/copper tile → miner → belt → smelter → belt → assembler → belt → hub (score)

iron ore   → smelter (2.2s) → iron-plate
copper ore → smelter (2.2s) → copper-plate
2x iron-plate → assembler (3.5s) → gear

Score: gear=10, iron-plate=3, copper-plate=2, other=1
```

### Belt Capacity

Belts hold at most **3 items**. Items have a `progress` field (0..1). `addItemToBelt()` returns `false` when full; the caller falls back to `addLooseItem()`.

### Spatial Lookups

Structures are stored in a `Map<string, Structure>` keyed by `"x,y"`. Use `key(x, y)` to generate the key and `structureAt(x, y)` to look up.

### Game Loop

```
requestAnimationFrame(loop)
  └─ loop(now)
       ├─ dt = min(0.1, (now - lastTime) / 1000)   // capped delta-time in seconds
       ├─ update(dt)
       │    ├─ updateMiners(dt)
       │    ├─ updateSmelters(dt)
       │    ├─ updateAssemblers(dt)
       │    ├─ updateBelts(dt)
       │    └─ updateLoose(dt)
       └─ draw()
            ├─ drawTiles()
            ├─ drawStructures()
            ├─ drawItems()
            ├─ drawHover()
            ├─ drawLastPlacement()
            └─ drawPauseOverlay()  (if paused)
```

---

## Key Conventions

### Coordinate System

- World is indexed `world[y][x]` — **y first**, then x.
- Map keys are `"x,y"` — **x first** (see `key(x,y)`).
- Canvas pixels: tile `(x, y)` → pixel `(x * tileSize, y * tileSize)`.

### Adding a New Structure Type

1. Add a branch in `placeStructure()` to construct and store its object.
2. Add placement validation logic in `canPlace()` if needed.
3. Add an `update*()` function called from `update()`.
4. Add a `draw*()` function called from `drawStructures()`.
5. Export the update function in the `module.exports` block if it needs testing.

### Testing Pattern

Tests import helpers via CommonJS and mutate the shared `state` singleton directly. Reset state in `beforeEach` using `Object.assign(state, createState())`. Use `jest.spyOn(Math, 'random')` to control randomness in world generation tests.

```js
const { createState, state, updateSmelters } = require('./main');

beforeEach(() => {
  Object.assign(state, createState());
});
```

### Browser-only Code Guard

Code that touches the DOM is guarded with:

```js
if (typeof document !== 'undefined' && typeof window !== 'undefined' && !window.__FACTORY_TEST__) {
  initializeGame();
}
```

CommonJS exports are similarly guarded:

```js
if (typeof module !== 'undefined') {
  module.exports = { ... };
}
```

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| B | Select belt |
| M | Select miner |
| S | Select smelter |
| A | Select assembler |
| H | Select hub |
| X | Select remove |
| R | Rotate selection |
| Space / P | Pause / resume |
| N | Reset / new map |

---

## Known Bugs in main.js

These bugs exist in the current codebase — do not work around them silently; fix the root cause.

1. **`updateSmelters()` (lines 264–273)**: Unreachable dead code after a `return` statement references undeclared variables `out`, `target`, `item`, `tile`. This code is never executed.

2. **`updateAssemblers()` (lines 298–299)**: Two `if` statements are nested incorrectly — the outer checks `i.type === 'iron-plate'` but the inner checks `i.type === 'iron'`. The filter only removes items matching the inner condition (`'iron'`), which never appears as an assembler input. The `removed >= 2` check is therefore never satisfied.

3. **`main.test.js` (line 18)**: `gridHeight` is listed twice in the destructuring import, causing a syntax issue.

---

## Resource Placement (World Generation)

Four fixed resource patches are seeded at game start — positions are deterministic but patch shapes vary with `Math.random()`:

| Resource | Center (cx, cy) | Radius |
|----------|----------------|--------|
| iron | (5, 9) | 4 |
| iron | (16, 6) | 3 |
| copper | (9, 12) | 4 |
| copper | (19, 10) | 3 |

---

## Rendering Notes

- Canvas is **960×640** px; the tile grid covers **800×576** px (25×18 tiles at 32px).
- All drawing uses the Canvas 2D API directly — no library.
- Colors are defined in the `colors` constant object at the top of `main.js`.
- Item colors are defined inline in `drawItem()`.
- Rendering is **immediate-mode**: the entire canvas is cleared and redrawn every frame.

---

## AGENTS.md vs. Current Implementation

`AGENTS.md` describes an ambitious, fully-featured Factorio clone with ECS, chunking, power networks, research, and multiplayer. The current `main.js` is a lean MVP that implements:

- Basic tile world (no chunks, no camera pan/zoom)
- Belts, miners, smelters, assemblers, hub
- No power system, no research, no inserters, no save/load

Do not expect the codebase to match the AGENTS.md architecture. AGENTS.md is a roadmap, not a description of current state.
