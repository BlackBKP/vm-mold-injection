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
const format = (value, unit) => value == null ? "—" : `${value}${unit}`;
let hasData = false;

async function loadShots() {
  if (refresh.disabled) return;
  refresh.disabled = true;

  try {
    const response = await fetch("/data/shots", { cache: "no-store" });
    if (!response.ok) throw new Error("Shot request failed");
    const shots = await response.json();
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
    updateFloor(shots);
    shotsTable.replaceChildren(...rows);
    hasData = shots.length > 0;
    status.removeAttribute("data-error");
    status.textContent = hasData
      ? `${shots.length} shots loaded · ${new Date().toLocaleTimeString()}`
      : "The API returned no shots.";
  } catch {
    status.setAttribute("data-error", "");
    status.textContent = hasData
      ? "Unable to refresh. Showing previously loaded shots."
      : "Unable to load shots. Check the API connection or try again.";
  } finally {
    refresh.disabled = false;
  }
}

refresh.addEventListener("click", loadShots);
setInterval(loadShots, 30000);

const cycleDuration = 8000;
const timing = { duration: cycleDuration, iterations: Infinity };
function animatePress(machine) {
  const movingMold = machine.querySelector(".moving").animate([
    { left: "8%", offset: 0, easing: "cubic-bezier(.32, 0, .2, 1)" },
    { left: "44%", offset: .25 },
    { left: "44%", offset: .75, easing: "cubic-bezier(.32, 0, .2, 1)" },
    { left: "8%", offset: .88 },
    { left: "8%", offset: 1 }
  ], timing);
  const material = machine.querySelector(".flow").animate([
    { transform: "scaleX(0)", offset: 0 },
    { transform: "scaleX(0)", offset: .25 },
    { transform: "scaleX(1)", offset: .49 },
    { transform: "scaleX(0)", offset: .50 },
    { transform: "scaleX(0)", offset: 1 }
  ], timing);
  const part = machine.querySelector(".part").animate([
    { opacity: 0, transform: "translateY(0)", offset: 0 },
    { opacity: 0, transform: "translateY(0)", offset: .48 },
    { opacity: 1, transform: "translateY(0)", offset: .50 },
    { opacity: 1, transform: "translateY(0)", offset: .86, easing: "ease-in" },
    { opacity: 0, transform: "translateY(220%)", offset: .98 },
    { opacity: 0, transform: "translateY(220%)", offset: 1 }
  ], timing);
  return [movingMold, material, part];
}

const progress = document.querySelector(".progress span");
const floor = document.querySelector("#presses");
const pressTemplate = document.querySelector("#press-template");
const speed = document.querySelector("#speed");
const phases = [...document.querySelectorAll("#phases li")];
const pause = document.querySelector("#pause");
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
const pressCount = 6;
const presses = new Map();
let latestByMachine = new Map();
let selected;
let currentPhase = -1;
let playing = !reducedMotion.matches;

function updateLatestShot() {
  const press = presses.get(selected);
  const latest = latestByMachine.get(press?.machineId);
  document.querySelector("#shot-label").textContent = latest
    ? `${latest.machineId} / ${latest.moldId} · Shot ${latest.shotCounter}`
    : "No shot data for this press";
  document.querySelector("#cycle-time").textContent = format(latest?.cycleTimeS, " s");
  document.querySelector("#pressure").textContent = format(latest?.injectionPressureBar, " bar");
  document.querySelector("#cushion").textContent = format(latest?.cushionMm, " mm");
  document.querySelector("#result").textContent = latest?.result ?? "—";
}

function selectPress(key) {
  presses.get(selected)?.button.setAttribute("aria-pressed", "false");
  selected = key;
  presses.get(selected).button.setAttribute("aria-pressed", "true");
  updateLatestShot();
  updatePhase();
}

function updateFloor(shots) {
  latestByMachine = new Map();
  for (const shot of shots) {
    if (!latestByMachine.has(shot.machineId)) latestByMachine.set(shot.machineId, shot);
  }

  const stations = [...latestByMachine.keys()].sort().map(machineId => ({
    key: `machine:${machineId}`,
    machineId,
    label: machineId,
    type: "Recorded shots"
  }));
  while (stations.length < pressCount) {
    const bay = stations.length + 1;
    stations.push({ key: `demo:${bay}`, label: `Press ${bay}`, type: "Demo press" });
  }

  const stationKeys = new Set(stations.map(station => station.key));
  for (const [key, press] of presses) {
    if (stationKeys.has(key)) continue;
    for (const animation of press.animations) animation.cancel();
    press.button.remove();
    presses.delete(key);
  }

  for (const [index, station] of stations.entries()) {
    if (!presses.has(station.key)) {
      const fragment = pressTemplate.content.cloneNode(true);
      const button = fragment.querySelector(".press");
      const machine = fragment.querySelector(".machine");
      button.querySelector(".press-render").append(machine);
      button.querySelector(".press-id").textContent = station.label;
      button.querySelector(".press-type").textContent = station.type;
      button.addEventListener("click", () => selectPress(station.key));
      const animations = animatePress(machine);
      for (const animation of animations) {
        animation.currentTime = index * 1350 % cycleDuration;
        animation.updatePlaybackRate(Number(speed.value));
        if (!playing) animation.pause();
      }
      presses.set(station.key, { ...station, button, animations });
    }

    const { button } = presses.get(station.key);
    if (floor.children[index] !== button) floor.insertBefore(button, floor.children[index] ?? null);
  }

  floor.dataset.layout = stations.length === 6 ? "standard" : "extended";
  const firstMachine = shots[0]?.machineId;
  const initialKey = firstMachine == null ? stations[0].key : `machine:${firstMachine}`;
  if (!presses.has(selected)) selectPress(initialKey);
  else updateLatestShot();
}

function updatePhase() {
  const clamp = presses.get(selected)?.animations[0];
  const fraction = ((clamp?.currentTime ?? 0) % cycleDuration) / cycleDuration;
  progress.style.transform = `scaleX(${fraction})`;
  const index = Math.floor(fraction * phases.length);
  if (index === currentPhase) return;
  if (currentPhase >= 0) phases[currentPhase].removeAttribute("aria-current");
  phases[index].setAttribute("aria-current", "step");
  currentPhase = index;
}

function setPlaying(next) {
  playing = next;
  for (const { animations } of presses.values()) {
    for (const animation of animations) {
      if (playing) animation.play();
      else animation.pause();
    }
  }
  pause.textContent = playing ? "Pause animation" : "Play animation";
  updatePhase();
}

speed.addEventListener("change", () => {
  for (const { animations } of presses.values()) {
    for (const animation of animations) animation.updatePlaybackRate(Number(speed.value));
  }
});
pause.addEventListener("click", () => setPlaying(!playing));
reducedMotion.addEventListener("change", event => setPlaying(!event.matches));
updateFloor([]);
setPlaying(playing);
setInterval(updatePhase, 80);
loadShots();


