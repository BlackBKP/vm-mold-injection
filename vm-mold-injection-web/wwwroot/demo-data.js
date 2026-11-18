const machines = [
  { machineId: "M01", moldId: "MD-1180", cycleTime: 29, pressure: 1180, cushion: 4.2 },
  { machineId: "M02", moldId: "MD-2231", cycleTime: 34, pressure: 1240, cushion: 3.8 },
  { machineId: "M03", moldId: "MD-3040", cycleTime: 26, pressure: 1090, cushion: 4.6 },
  { machineId: "M04", moldId: "MD-4150", cycleTime: 38, pressure: 1320, cushion: 3.5 },
  { machineId: "M05", moldId: "MD-5020", cycleTime: 31, pressure: 1160, cushion: 4.1 },
  { machineId: "M06", moldId: "MD-6012", cycleTime: 36, pressure: 1280, cushion: 3.9 }
];
const epoch = Date.UTC(2026, 0, 1);

// Derive each reading from its shot number so refreshes within a cycle are stable.
export function generateDemoShots(now = Date.now()) {
  const shots = [];
  for (const [index, machine] of machines.entries()) {
    const cycleMilliseconds = machine.cycleTime * 1000;
    const offset = index * 1700;
    const currentShot = Math.floor((now - epoch - offset) / cycleMilliseconds);
    for (let history = 0; history < 12; history++) {
      const shot = currentShot - history;
      const variation = Math.sin(shot * 1.7 + index);
      shots.push({
        machineId: machine.machineId,
        moldId: machine.moldId,
        shotCounter: 10000 + shot,
        shotTime: new Date(epoch + shot * cycleMilliseconds + offset).toISOString(),
        cycleTimeS: Number((machine.cycleTime + variation * .6).toFixed(2)),
        cushionMm: Number((machine.cushion + variation * .25).toFixed(2)),
        injectionPressureBar: Number((machine.pressure + variation * 24).toFixed(1)),
        result: (shot + index * 3) % 13 === 0 ? "NG" : "OK",
        sourceFile: `showcase-${machine.machineId}.csv`
      });
    }
  }
  return shots.sort((first, second) =>
    second.shotTime.localeCompare(first.shotTime) || first.machineId.localeCompare(second.machineId));
}
