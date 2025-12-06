const {
  key,
  inBounds,
  moveForward,
  addItemToBelt,
  addToStorage,
  createState,
  genWorld,
  seedResource,
  directions,
  gridWidth,
  gridHeight,
  state,
  canPlace,
  resetGame,
  trackDelivered
} = require('./main');

describe('utility helpers', () => {
  test('key composes coordinates consistently', () => {
    expect(key(3, 7)).toBe('3,7');
  });

  test('inBounds respects grid dimensions', () => {
    expect(inBounds(0, 0)).toBe(true);
    expect(inBounds(gridWidth - 1, gridHeight - 1)).toBe(true);
    expect(inBounds(-1, 0)).toBe(false);
    expect(inBounds(gridWidth, gridHeight)).toBe(false);
  });

  test('moveForward shifts coordinates by direction index', () => {
    expect(moveForward(5, 5, 0)).toEqual({ x: 6, y: 5 });
    expect(moveForward(5, 5, 1)).toEqual({ x: 5, y: 6 });
    expect(moveForward(5, 5, 2)).toEqual({ x: 4, y: 5 });
    expect(moveForward(5, 5, 3)).toEqual({ x: 5, y: 4 });
  });
});

describe('world generation', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('genWorld fills grid and seeds resource patches', () => {
    const testState = createState();
    jest.spyOn(Math, 'random').mockReturnValue(0);

    genWorld(testState);

    expect(testState.world.length).toBe(gridHeight);
    expect(testState.world[0].length).toBe(gridWidth);
    expect(testState.world[9][5].resource?.type).toBe('iron');
    expect(testState.world[10][19].resource?.type).toBe('copper');
  });

  test('seedResource applies to provided state', () => {
    const testState = createState();
    testState.world = Array.from({ length: gridHeight }, () =>
      Array.from({ length: gridWidth }, () => ({ type: 'grass', resource: null }))
    );

    jest.spyOn(Math, 'random').mockReturnValue(0);
    seedResource('iron', 2, 2, 1, testState);

    expect(testState.world[2][2].resource?.type).toBe('iron');
    expect(testState.world[2][2].resource?.amount).toBe(9999);
  });
});

describe('belts and items', () => {
  test('addItemToBelt limits capacity and resets progress', () => {
    const belt = { type: 'belt', dir: directions[0], items: [{ type: 'iron', progress: 0.5 }] };

    expect(addItemToBelt(belt, { type: 'iron' })).toBe(true);
    expect(belt.items[1].progress).toBe(0);

    belt.items.push({ type: 'iron', progress: 0.2 }, { type: 'iron', progress: 0.3 });
    expect(addItemToBelt(belt, { type: 'iron' })).toBe(false);
    expect(belt.items.length).toBe(4);
  });

  test('addToStorage respects capacity', () => {
    const storage = { type: 'storage', items: [], capacity: 2 };
    expect(addToStorage(storage, { type: 'iron' })).toBe(true);
    expect(addToStorage(storage, { type: 'copper' })).toBe(true);
    expect(addToStorage(storage, { type: 'gear' })).toBe(false);
    expect(storage.items.map((i) => i.type)).toEqual(['iron', 'copper']);
  });
});

describe('placement helpers', () => {
  test('miners require a resource tile', () => {
    state.world = Array.from({ length: gridHeight }, () =>
      Array.from({ length: gridWidth }, () => ({ type: 'grass', resource: null }))
    );
    state.structures = new Map();

    expect(canPlace(1, 1, 'miner')).toBe(false);

    state.world[1][1].resource = { type: 'iron', amount: 10 };
    expect(canPlace(1, 1, 'miner')).toBe(true);
  });

  test('resetGame clears structures and stateful fields', () => {
    state.structures = new Map([['1,1', { type: 'hub' }]]);
    state.score = 99;
    state.paused = true;
    state.deliveredCounts = { iron: 2 };
    resetGame();

    expect(state.structures.size).toBe(0);
    expect(state.score).toBe(0);
    expect(state.paused).toBe(false);
    expect(state.world.length).toBe(gridHeight);
    expect(state.deliveredCounts).toEqual({});
  });
});

describe('tracking helpers', () => {
  test('trackDelivered tallies items', () => {
    state.deliveredCounts = {};
    trackDelivered('iron');
    trackDelivered('iron');
    trackDelivered('gear');

    expect(state.deliveredCounts).toEqual({ iron: 2, gear: 1 });
  });
});
