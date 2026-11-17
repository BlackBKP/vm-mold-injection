const themeButton = document.querySelector("#theme");
const systemTheme = matchMedia("(prefers-color-scheme: dark)");
let savedTheme;

try {
  savedTheme = localStorage.getItem("injection-monitor-theme");
} catch {
  // Keep the theme switch available when storage is blocked.
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  themeButton.textContent = theme === "dark" ? "Light theme" : "Dark theme";
}

function applySystemTheme() {
  applyTheme(systemTheme.matches ? "dark" : "light");
}

if (savedTheme === "dark" || savedTheme === "light") applyTheme(savedTheme);
else applySystemTheme();

themeButton.addEventListener("click", () => {
  savedTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  applyTheme(savedTheme);
  try {
    localStorage.setItem("injection-monitor-theme", savedTheme);
  } catch {
    // The current page still uses the selected theme.
  }
});
systemTheme.addEventListener("change", () => {
  if (!savedTheme) applySystemTheme();
});

const status = document.querySelector("#status");
const refresh = document.querySelector("#refresh");
const shotsTable = document.querySelector("#shots");
const machineList = document.querySelector("#machine-list");
const speed = document.querySelector("#speed");
const pause = document.querySelector("#pause");
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
const phases = [...document.querySelectorAll("#phases li")];
const progress = document.querySelector(".progress span");
const machines = new Map();
const stationButtons = new Map();
let selected;
let factory;
let stations = [];
let hasData = false;
let feedFailed = false;
let playing = !reducedMotion.matches;
let currentPhase = -1;

function format(value, unit = "") {
  if (value == null) return "—";
  return typeof value === "number" ? `${value.toLocaleString(undefined, { maximumFractionDigits: 3 })}${unit}` : String(value);
}

function machineStatus(machine) {
  if (!machine) return { text: "Demo", kind: "demo" };
  if (feedFailed) return { text: "Connection lost", kind: "stale" };
  if (!machine.inWindow) return { text: "No recent shots", kind: "unknown" };
  const result = machine.shot.result;
  return {
    text: result ? `Latest ${result}` : "Result unavailable",
    kind: result?.toUpperCase() === "OK" ? "ok" : "attention"
  };
}

function updateDetails() {
  const station = stations.find(item => item.key === selected);
  const machine = machines.get(station?.machineId);
  const latest = machine?.shot;
  document.querySelector("#detail-title").textContent = station?.label ?? "Select a machine";
  const state = document.querySelector("#detail-state");
  state.textContent = station ? station.status.text : "—";
  state.dataset.state = station?.status.kind ?? "";
  document.querySelector("#shot-label").textContent = station
    ? latest ? "Latest available shot from this machine." : "Demo press · No connected machine data."
    : "Click a machine or its label to inspect its latest shot.";
  const fields = {
    "cycle-time": format(latest?.cycleTimeS, " s"),
    pressure: format(latest?.injectionPressureBar, " bar"),
    cushion: format(latest?.cushionMm, " mm"),
    result: latest?.result ?? "—",
    "mold-id": latest?.moldId ?? "—",
    "shot-counter": format(latest?.shotCounter),
    "shot-time": latest?.shotTime?.replace("T", " ") ?? "—",
    "fetched-time": machine?.fetchedAt.toLocaleTimeString() ?? "—",
    "source-file": latest?.sourceFile ?? "—"
  };
  for (const [id, value] of Object.entries(fields)) document.getElementById(id).textContent = value;
}

function selectMachine(key) {
  selected = key;
  factory?.select(key);
  for (const [stationKey, button] of stationButtons) {
    button.setAttribute("aria-pressed", String(stationKey === key));
  }
  updateDetails();
}

function updateFloor() {
  stations = [...machines.keys()].sort().map(machineId => ({
    key: `machine:${machineId}`, machineId, label: machineId,
    status: machineStatus(machines.get(machineId))
  }));
  while (stations.length < 6) {
    const bay = stations.length + 1;
    stations.push({ key: `demo:${bay}`, label: `Press ${bay}`, status: machineStatus() });
  }
  const keys = new Set(stations.map(station => station.key));
  if (!keys.has(selected)) selected = undefined;
  for (const [key, button] of stationButtons) {
    if (keys.has(key)) continue;
    button.remove();
    stationButtons.delete(key);
  }
  stations.forEach((station, index) => {
    if (!stationButtons.has(station.key)) {
      const button = document.createElement("button");
      button.type = "button";
      button.addEventListener("click", () => selectMachine(station.key));
      stationButtons.set(station.key, button);
    }
    const button = stationButtons.get(station.key);
    button.textContent = `${station.label} · ${station.status.text}`;
    button.setAttribute("aria-pressed", String(station.key === selected));
    if (machineList.children[index] !== button) machineList.insertBefore(button, machineList.children[index] ?? null);
  });
  factory?.update(stations, selected);
  updateDetails();
}

async function loadShots() {
  if (refresh.disabled) return;
  refresh.disabled = true;
  try {
    const response = await fetch("/data/shots", { cache: "no-store" });
    if (!response.ok) throw new Error("Shot request failed");
    const shots = await response.json();
    if (!Array.isArray(shots) || shots.some(shot => !shot || typeof shot.machineId !== "string")) {
      throw new Error("Unexpected shot response");
    }
    const fetchedAt = new Date();
    for (const machine of machines.values()) machine.inWindow = false;
    // The API returns newest shots first. Keep one latest record per machine.
    const seen = new Set();
    for (const shot of shots) {
      if (seen.has(shot.machineId)) continue;
      machines.set(shot.machineId, { shot, fetchedAt, inWindow: true });
      seen.add(shot.machineId);
    }
    const rows = shots.map(shot => {
      const row = document.createElement("tr");
      const values = [
        shot.shotTime?.replace("T", " "), shot.machineId, shot.moldId,
        shot.shotCounter, shot.cycleTimeS, shot.cushionMm,
        shot.injectionPressureBar, shot.result
      ];
      for (const value of values) row.insertCell().textContent = value ?? "—";
      return row;
    });
    shotsTable.replaceChildren(...rows);
    hasData = machines.size > 0;
    feedFailed = false;
    status.removeAttribute("data-error");
    status.textContent = shots.length
      ? `${shots.length} shots · ${seen.size} machines in latest response · Updated ${fetchedAt.toLocaleTimeString()}`
      : "The API returned no recent shots.";
  } catch {
    feedFailed = true;
    status.setAttribute("data-error", "");
    status.textContent = hasData
      ? "Connection lost. Showing last fetched data. Retrying every 5 seconds."
      : "Unable to load shots. Showing demo presses. Retrying every 5 seconds.";
  } finally {
    updateFloor();
    refresh.disabled = false;
  }
}

function updatePhase(fraction) {
  progress.style.transform = `scaleX(${fraction})`;
  const index = Math.floor(fraction * phases.length);
  if (index === currentPhase) return;
  if (currentPhase >= 0) phases[currentPhase].removeAttribute("aria-current");
  phases[index].setAttribute("aria-current", "step");
  currentPhase = index;
}

function setPlaying(value) {
  playing = value;
  factory?.setPlaying(playing);
  pause.textContent = playing ? "Pause animation" : "Play animation";
}

pause.addEventListener("click", () => setPlaying(!playing));
speed.addEventListener("change", () => factory?.setSpeed(Number(speed.value)));
reducedMotion.addEventListener("change", event => setPlaying(!event.matches));
document.querySelector("#reset-view").addEventListener("click", () => factory?.resetView());
document.querySelector("#zoom-in").addEventListener("click", () => factory?.zoom(.85));
document.querySelector("#zoom-out").addEventListener("click", () => factory?.zoom(1.15));
refresh.addEventListener("click", loadShots);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) loadShots();
});
setInterval(() => {
  if (!document.hidden) loadShots();
}, 5000);
setPlaying(playing);
updateFloor();
loadShots();

try {
  const { createFactoryScene } = await import("./factory-scene.js");
  factory = createFactoryScene(selectMachine, updatePhase);
  factory.setPlaying(playing);
  factory.setSpeed(Number(speed.value));
  factory.update(stations, selected);
} catch (error) {
  console.error("Unable to initialize factory scene", error);
  document.querySelector("#scene-error").hidden = false;
  document.querySelector("#scene-error").textContent =
    "The 3D view could not start. Enable WebGL in your browser. Select a machine below to view its data.";
  for (const id of ["reset-view", "zoom-in", "zoom-out", "speed", "pause"]) {
    document.getElementById(id).disabled = true;
  }
}
