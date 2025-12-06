const resources = {
  ore: { label: "Ore", amount: 0, description: "Raw stone and metal scraped from nearby asteroids." },
  ingot: { label: "Ingots", amount: 0, description: "Smelted metal ready for fabrication." },
  part: { label: "Machine Parts", amount: 0, description: "Assemblies used to bootstrap new machinery." },
  power: { label: "Stored Power", amount: 5, description: "Buffered energy available for your grid." },
};

const buildings = [
  {
    id: "drill",
    name: "Auto-Drill",
    tier: "T1 extraction",
    description: "Pulls ore from the ground autonomously.",
    cost: { ore: 10 },
    production: (count) => ({ ore: count * 1 }),
    power: (count) => ({ generate: 0, use: count * 1 }),
  },
  {
    id: "furnace",
    name: "Induction Furnace",
    tier: "T2 smelting",
    description: "Consumes ore and heat to create ingots.",
    cost: { ore: 20, power: 10 },
    production: (count, efficiency) => ({ ingot: count * 0.6 * efficiency, ore: count * -0.8 * efficiency }),
    power: (count) => ({ generate: 0, use: count * 1.5 }),
  },
  {
    id: "assembler",
    name: "Micro Assembler",
    tier: "T3 fabrication",
    description: "Builds machine parts from ingots and a dash of ingenuity.",
    cost: { ingot: 12, power: 18 },
    production: (count, efficiency) => ({ part: count * 0.35 * efficiency, ingot: count * -0.6 * efficiency }),
    power: (count) => ({ generate: 0, use: count * 2 }),
  },
  {
    id: "solar",
    name: "Solar Field",
    tier: "Utility",
    description: "Generates free power as long as the sun shows up for work.",
    cost: { ore: 6, ingot: 3 },
    production: () => ({}),
    power: (count) => ({ generate: count * 3, use: 0 }),
  },
];

const state = {
  buildings: Object.fromEntries(buildings.map((b) => [b.id, 0])),
  tick: 0,
  log: [],
  powerSnapshot: { generate: 0, use: 0, efficiency: 1 },
  productionPaused: false,
};

const ui = {
  resourceGrid: document.querySelector("#resource-grid"),
  harvestBtn: document.querySelector("#harvest-btn"),
  automationToggle: document.querySelector("#automation-toggle"),
  automationStatus: document.querySelector("#automation-status"),
  buildingContainer: document.querySelector("#buildings"),
  log: document.querySelector("#log"),
  power: document.querySelector("#power-readout"),
  powerBar: document.querySelector("#power-bar"),
  flowGrid: document.querySelector("#flow-grid"),
  clock: document.querySelector("#clock"),
};

function formatNumber(value) {
  return Math.round(value * 100) / 100;
}

function createResourceCards() {
  ui.resourceGrid.innerHTML = "";
  Object.entries(resources).forEach(([id, resource]) => {
    const card = document.createElement("div");
    card.className = "resource";
    card.innerHTML = `
      <strong>${resource.label}</strong>
      <div class="eyebrow">${resource.description}</div>
      <div id="${id}-value" class="value">${formatNumber(resource.amount)}</div>
    `;
    ui.resourceGrid.appendChild(card);
  });
}

function createBuildingCards() {
  const tpl = document.querySelector("#building-template");
  buildings.forEach((building) => {
    const instance = tpl.content.cloneNode(true);
    instance.querySelector(".building-tier").textContent = building.tier;
    instance.querySelector(".building-name").textContent = building.name;
    instance.querySelector(".building-desc").textContent = building.description;
    instance.querySelector(".building-count").id = `${building.id}-count`;
    const costEl = instance.querySelector(".building-cost");
    costEl.textContent = `Cost: ${describeCost(building.cost)}`;
    const button = instance.querySelector(".buy-btn");
    button.id = `${building.id}-buy`;
    button.addEventListener("click", () => buyBuilding(building));
    ui.buildingContainer.appendChild(instance);
  });
}

function describeCost(cost) {
  return Object.entries(cost)
    .map(([res, value]) => `${value} ${resources[res].label}`)
    .join(" · ");
}

function buyBuilding(building) {
  if (!canAfford(building.cost)) {
    pushLog(`Not enough resources for ${building.name}.`, true);
    return;
  }
  pay(building.cost);
  state.buildings[building.id] += 1;
  pushLog(`Queued ${building.name}. Total: ${state.buildings[building.id]}`);
  updateUi();
}

function canAfford(cost) {
  return Object.entries(cost).every(([res, amount]) => resources[res].amount >= amount);
}

function pay(cost) {
  Object.entries(cost).forEach(([res, amount]) => {
    resources[res].amount -= amount;
  });
}

function pushLog(message, warn = false) {
  const entry = document.createElement("li");
  entry.textContent = message;
  if (warn) entry.style.color = "var(--danger)";
  ui.log.prepend(entry);
  while (ui.log.children.length > 8) ui.log.removeChild(ui.log.lastChild);
}

function updateResources(delta) {
  Object.entries(delta).forEach(([res, amount]) => {
    if (!resources[res]) return;
    resources[res].amount += amount;
    if (resources[res].amount < 0) resources[res].amount = 0;
  });
}

function updateUi() {
  Object.entries(resources).forEach(([id, res]) => {
    const el = document.querySelector(`#${id}-value`);
    if (el) el.textContent = formatNumber(res.amount);
  });
  buildings.forEach((b) => {
    const count = document.querySelector(`#${b.id}-count`);
    if (count) count.textContent = `x${state.buildings[b.id]}`;
  });
  renderAutomationToggle();
  renderAutomationStatus();
  renderPower();
  renderFlow();
}

function renderAutomationToggle() {
  if (!ui.automationToggle) return;
  ui.automationToggle.textContent = state.productionPaused ? "Resume automation" : "Pause automation";
  ui.automationToggle.ariaPressed = state.productionPaused;
  ui.automationToggle.classList.toggle("active", state.productionPaused);
}

function renderAutomationStatus() {
  if (!ui.automationStatus) return;
  ui.automationStatus.textContent = state.productionPaused
    ? "Consumers halted — generators still running"
    : "Automation running";
  ui.automationStatus.classList.toggle("paused", state.productionPaused);
}

function renderPower() {
  const { generate, use, efficiency } = state.powerSnapshot;
  const pausedNote = state.productionPaused ? " (consumers paused)" : "";
  ui.power.textContent = `Grid: ${formatNumber(generate)} MW produced / ${formatNumber(use)} MW used${pausedNote}`;
  const ratio = use === 0 ? (generate > 0 ? 1 : 0) : Math.min(1, efficiency);
  ui.powerBar.style.width = `${Math.max(6, ratio * 100)}%`;
  ui.powerBar.style.background = ratio < 0.4 ? `linear-gradient(90deg, var(--danger), #ff9b6b)` : "";
  ui.powerBar.title =
    use === 0
      ? generate > 0
        ? "Surplus available — consumers idle"
        : "Grid idle"
      : ratio < 1
      ? "Power limited — output throttled"
      : "Stable grid";
}

function renderFlow() {
  const flow = summarizeFlow();
  ui.flowGrid.innerHTML = "";
  Object.entries(flow).forEach(([name, amount]) => {
    const item = document.createElement("div");
    item.textContent = `${name}: ${formatNumber(amount)} /s`;
    ui.flowGrid.appendChild(item);
  });
}

function summarizeFlow() {
  const { efficiency } = state.powerSnapshot;
  const totals = { Ore: 0, Ingots: 0, "Machine Parts": 0 };
  const active = getActiveBuildings(state.productionPaused);
  active.forEach((building) => {
    const prod = building.production(state.buildings[building.id], efficiency);
    Object.entries(prod).forEach(([res, amount]) => {
      if (res === "ore") totals.Ore += amount;
      if (res === "ingot") totals.Ingots += amount;
      if (res === "part") totals["Machine Parts"] += amount;
    });
  });
  return totals;
}

function getActiveBuildings(paused) {
  if (!paused) return buildings;
  return buildings.filter((building) => {
    const sample = building.production(state.buildings[building.id], 1);
    return Object.values(sample).every((amount) => amount >= 0);
  });
}

function resolvePower({ activeBuildings = buildings, ignoreUse = false } = {}) {
  let generate = 0;
  let use = 0;

  activeBuildings.forEach((b) => {
    const power = b.power(state.buildings[b.id]);
    generate += power.generate;
    use += ignoreUse ? 0 : power.use;
  });

  let stored = resources.power.amount;
  let efficiency = 1;

  if (use > generate) {
    const deficit = use - generate;
    if (stored >= deficit) {
      stored -= deficit;
    } else {
      const available = generate + stored;
      efficiency = available / use;
      stored = 0;
    }
  } else {
    stored += generate - use;
  }

  resources.power.amount = Math.max(0, stored);
  state.powerSnapshot = { generate, use, efficiency };
  return state.powerSnapshot;
}

function tick() {
  state.tick += 1;
  const active = getActiveBuildings(state.productionPaused);
  const { efficiency } = resolvePower({ activeBuildings: active, ignoreUse: state.productionPaused && active.length === 0 });

  active.forEach((building) => {
    const prod = building.production(state.buildings[building.id], efficiency);
    if (!state.productionPaused || Object.values(prod).every((amount) => amount >= 0)) {
      updateResources(prod);
    }
  });

  if (state.tick % 4 === 0) pushLog(`Tick ${state.tick}: automation pulse`);
  updateUi();
  updateClock();
}

function updateClock() {
  const minutes = Math.floor(state.tick / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (state.tick % 60).toString().padStart(2, "0");
  ui.clock.textContent = `${minutes}:${seconds}`;
}

function manualHarvest() {
  resources.ore.amount += 2;
  resources.power.amount += 0.2;
  pushLog("Manual harvest yielded ore and charge.");
  updateUi();
}

function init() {
  createResourceCards();
  createBuildingCards();
  ui.harvestBtn.addEventListener("click", manualHarvest);
  ui.automationToggle.addEventListener("click", toggleAutomation);
  pushLog("Factory initialized. Begin with manual harvests.");
  updateUi();
  setInterval(tick, 1000);
}

function toggleAutomation() {
  state.productionPaused = !state.productionPaused;
  pushLog(
    state.productionPaused
      ? "Automation paused. Extractors and generators stay online; consumers halt."
      : "Automation resumed."
  );
  updateUi();
}

init();
