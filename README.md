# Factory Game

A browser-based **Factorio-inspired automation game** built with JavaScript.

## Overview

Factory Game focuses on the core pillars of automation games:

- Deterministic simulation
- Item logistics (belts, inserters, inventories)
- Production chains (machines + recipes)
- Power and research progression
- Scalable architecture for large factories

## Current Tech

- **Language:** JavaScript
- **Testing:** Jest

## Getting Started

### Prerequisites

- Node.js (LTS recommended)
- npm

### Install

```bash
npm install
```

### Run tests

```bash
npm test
```

## Planned Architecture

The project is organized around modular game “agents”/systems, including:

- Game Loop
- World & Chunks
- Entity/Component Systems
- Item Flow & Logistics
- Production
- Power Networks
- Research
- Rendering
- Input/UI
- Persistence

See [`AGENTS.md`](./AGENTS.md) for the full architecture and implementation roadmap.

## Roadmap (high-level)

1. Core loop, tile world, camera
2. Belts and item movement
3. Machines and recipes
4. Inserters/chests for full automation loops
5. Power and research systems
6. Save/load and UI polish
7. Advanced systems (modding/multiplayer)

## Contributing

Contributions are welcome. Open an issue or pull request to discuss improvements and features.

## License

Currently set to **ISC** (see `package.json`).
