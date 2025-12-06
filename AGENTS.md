Here it is **properly formatted as Markdown** (no code fences around the whole file, the document *is* the Markdown now).
Everything has been preserved, cleaned up, and structured for direct use as an `AGENTS.md` file.

---

# AGENTS.md — Building a Factorio-Like Game in JavaScript

This document describes the **agents** (systems, roles, modules) involved in building a Factorio-style automation game using JavaScript (or TypeScript). The goal is to outline how to build a **2D top-down, tile-based, automation-driven game** with belts, inserters, machines, power networks, research, and scalable simulation.

---

## 1. Project Scope & Pillars

### 1.1 Core Pillars

A Factorio-like game rests on:

* **Automation** — machines and belts run themselves based on deterministic rules.
* **Spatial Logistics** — tile/grid world, throughput, placement constraints.
* **Progression** — tech tree, recipes, unlocks.
* **Performance at Scale** — thousands of entities simulated efficiently.
* **Modularity** — rendering, simulation, UI, and content are separate concerns.

---

## 2. Tech Stack & Architecture

### 2.1 Technologies

* **JavaScript or TypeScript**
* **Rendering**: Canvas 2D → PixiJS or WebGL for performance
* **ECS (Entity Component System)** for simulation
* **Vite/Webpack/esbuild** for build pipeline
* **Custom state store** for game systems

### 2.2 Major Subsystems ("Agents")

* Game Loop Agent
* World & Chunk Agent
* Entity System Agent
* Item Flow Agent
* Production Agent
* Power Agent
* Research Agent
* Rendering Agent
* Input & UI Agent
* Persistence Agent
* Multiplayer Agent (optional)

---

## 3. Game Loop Agent

### Responsibilities

* Fixed-timestep simulation.
* Decoupled rendering via `requestAnimationFrame`.
* Deterministic update order.

### Example Loop

```js
const TICK_RATE = 60;
const TICK_INTERVAL = 1000 / TICK_RATE;

let lastTime = performance.now();
let accumulator = 0;

function gameLoop(now) {
  const delta = now - lastTime;
  lastTime = now;
  accumulator += delta;

  while (accumulator >= TICK_INTERVAL) {
    update(TICK_INTERVAL / 1000);
    accumulator -= TICK_INTERVAL;
  }

  render(accumulator / TICK_INTERVAL);
  requestAnimationFrame(gameLoop);
}
requestAnimationFrame(gameLoop);
```

---

## 4. World & Chunk Agent

### Responsibilities

* Tile grid for terrain & resources.
* Chunking system for large world generation and optimization.
* Collision/occupancy tracking.

### Data Structures

```ts
type TileType = 'grass' | 'water' | 'ore_iron' | 'ore_copper' | 'ore_coal';

interface Tile {
  type: TileType;
  elevation: number;
  resourceAmount?: number;
}

interface Chunk {
  x: number;
  y: number;
  tiles: Tile[];
}

interface World {
  chunks: Map<string, Chunk>;
}
```

---

## 5. Entity System & Components Agent

### Why ECS?

* Efficient iteration
* Cache-friendly data
* Clear separation of logic (systems) vs data (components)

### Example Components

* Position
* Sprite
* Belt
* Inserter
* Machine
* Inventory
* PowerProducer
* PowerConsumer
* Health
* AI

### Example Systems

* BeltSystem
* InserterSystem
* MachineSystem
* PowerSystem
* AISystem
* RenderSystem

---

## 6. Item & Logistics Agent (Belts, Inserters, Inventories)

### Items and Stacks

```ts
interface ItemStack {
  itemId: string;
  amount: number;
  maxStack: number;
}
```

### Belt Model

Belts typically store items as:

```ts
interface ItemOnBelt {
  itemId: string;
  offset: number; // 0..1
}

interface BeltComponent {
  direction: 'up' | 'down' | 'left' | 'right';
  speed: number;
  items: ItemOnBelt[];
}
```

### Inserter Logic

Inserters operate in states:

* Idle
* Picking
* Moving
* Dropping

### Inventories

All inventories share a common model: fixed slots, merging stacks where possible.

---

## 7. Production Agent (Machines & Recipes)

### Recipe Definition

```ts
interface Recipe {
  id: string;
  inputs: { itemId: string; amount: number }[];
  outputs: { itemId: string; amount: number }[];
  time: number;
  powerUsage: number;
  enabledByDefault: boolean;
  unlockedBy?: string[];
}
```

### Machine Component

```ts
interface MachineComponent {
  recipeId: string | null;
  progress: number;
  working: boolean;
}
```

### Machine Simulation Steps

1. Check power
2. Check input availability
3. Advance progress
4. Output items
5. Repeat

---

## 8. Power Agent

### Power Network

Use a **graph** or **union-find** to track connected networks.

Each network tracks:

* Total production
* Total demand
* Power ratio = `min(1, production / demand)`

Machines adjust behavior based on this ratio.

### Generators

Boilers, burners, solar, steam engines, turbines.
Each represented with `PowerProducerComponent` and optional fuel inventory.

---

## 9. Research Agent

### Tech Structure

```ts
interface Tech {
  id: string;
  name: string;
  description: string;
  cost: { itemId: string; amount: number }[];
  prerequisites: string[];
  unlocksRecipes: string[];
  unlocksEntities: string[];
}
```

### Labs

Labs consume science packs and contribute research points per tick.

---

## 10. Rendering Agent

### Camera

* Tracks world position & zoom
* Applies transforms to draw world coordinates onto screen

### Render Pipeline

1. Clear screen
2. Draw terrain
3. Draw entities
4. Draw overlays (power lines, selection boxes)
5. Draw UI

Use batching or sprite sheets for performance.

---

## 11. Input & UI Agent

### Build Mode

* Placement preview (ghost)
* Valid/invalid placement indicators
* Rotation (R)
* Click to place

### Interaction

* Left-click: select
* Right-click: open inventory or action menu
* Hotkeys: 1–9 slots

### HUD Elements

* Power status
* Research queue
* Inventory
* Alerts

---

## 12. Persistence Agent (Save/Load)

### Save Format

Store:

* World seed + modified tiles
* All entities & components
* Player state
* Research state
* Metadata (save version)

Use LocalStorage, IndexedDB, or downloadable JSON.

### Versioning

Include `saveVersion` + migration logic.

---

## 13. Multiplayer Agent (Optional)

### Deterministic Lockstep

* All players simulate the same tick deterministically.
* Only inputs are transmitted over network.
* No random behavior unless seeded.

### Networking Options

* WebSockets
* WebRTC peer-to-peer

---

## 14. Performance Agent

### Techniques

* Flat arrays for ECS storage
* Chunk-based simulation
* Reduced frequency updates for far-away elements
* Avoid memory allocations inside the tick loop
* Batch drawing operations

---

## 15. Content & Balancing Agent

### Data-Driven Content

Items, recipes, buildings, and tech definitions live in JSON.

### Progression Curve

General stages:

1. Manual → basic automation
2. Mining + belts
3. Assemblers + early science
4. Oil processing, advanced science
5. Late-game megabase

---

## 16. Tools & Modding Agent (Optional)

* In-game debug overlay
* Map editor
* JSON-based content packs
* Optional scripting interface with sandboxing

---

## 17. Suggested Folder Structure

```plaintext
src/
  core/
    loop.ts
    ecs/
      entity.ts
      components/
      systems/
  world/
    world.ts
    chunks.ts
    terrainGen.ts
  simulation/
    belts.ts
    inserters.ts
    machines.ts
    power.ts
    research.ts
  rendering/
    renderer.ts
    camera.ts
    sprites.ts
  ui/
    hud.ts
    buildMenu.ts
    input.ts
  data/
    items.json
    recipes.json
    techs.json
  persistence/
    saveLoad.ts
  multiplayer/
    net.ts
```

---

## 18. Implementation Roadmap

### Milestone 1

Core loop, tile world, camera movement.

### Milestone 2

Belts + item movement.

### Milestone 3

Machines + recipes.

### Milestone 4

Inserters + chests → full automation loop.

### Milestone 5

Power system + research.

### Milestone 6

UI polish, save/load.

### Milestone 7

Advanced features: enemies, oil processing, modding, multiplayer.

---

## 19. Design Principles

* Deterministic simulation
* Data-driven gameplay
* Modular, isolated agents
* Scale testing early
* Developer tooling helps build the game faster

---

