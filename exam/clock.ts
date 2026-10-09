// Logical wall time cannot move backwards during a page lifetime.
let wall = Date.now();
let monotonic = typeof performance === "undefined" ? 0 : performance.now();
let floor = wall;
export function clockNow(): number {
  const elapsed =
    typeof performance === "undefined" ? 0 : performance.now() - monotonic;
  floor = Math.max(floor, Date.now(), wall + elapsed);
  return floor;
}
export function restoreClock(lastSeen: number): boolean {
  const rollback = Date.now() < lastSeen - 2000;
  wall = Math.max(Date.now(), lastSeen);
  monotonic = performance.now();
  floor = wall;
  return rollback;
}
export function remainingSeconds(endsAt: number, now: number) {
  return Math.max(0, Math.ceil((endsAt - now) / 1000));
}
export function audioPosition(durations: number[], elapsed: number) {
  let offset = Math.max(0, elapsed);
  for (let index = 0; index < durations.length; index++) {
    if (offset < durations[index]) return { index, offset };
    offset -= durations[index];
  }
  return { index: durations.length, offset: 0 };
}
