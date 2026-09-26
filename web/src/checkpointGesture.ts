// Adapted from Creo Influence V10's SnapScroll gesture admission. Decay belongs
// to the current gesture; a pause, reversal or renewed acceleration starts another.
export const STOP_EPSILON = 2;

export class CheckpointGesture {
  private lastInput = -Infinity;
  private direction = 0;
  private intent = 0;
  private committed = false;
  private committedAt = 0;
  private lastMagnitude = 0;
  private peak = 0;
  private decelerated = false;
  private trough = Infinity;

  reset() {
    this.lastInput = -Infinity;
    this.direction = 0;
    this.intent = 0;
    this.committed = false;
    this.peak = 0;
    this.decelerated = false;
    this.trough = Infinity;
    this.lastMagnitude = 0;
  }

  admit(delta: number, now: number): number {
    const direction = Math.sign(delta);
    const magnitude = Math.abs(delta);
    const gap = now - this.lastInput;
    this.lastInput = now;
    if (magnitude < 4) {
      if (magnitude < this.peak * .45) this.decelerated = true;
      if (this.decelerated) this.trough = Math.min(this.trough, magnitude);
      this.lastMagnitude = magnitude;
      return 0;
    }
    const renewed = this.committed && now - this.committedAt > 160 && (
      (gap >= 100 && magnitude >= 42 && magnitude >= this.lastMagnitude * .95) ||
      (this.decelerated && magnitude >= 12 && magnitude >= this.trough * 1.8)
    );
    if (gap > 260 || direction === -this.direction || renewed) {
      this.intent = 0;
      this.committed = false;
      this.peak = 0;
      this.decelerated = false;
      this.trough = Infinity;
    }
    this.direction = direction;
    this.peak = Math.max(this.peak, magnitude);
    if (magnitude < this.peak * .45) this.decelerated = true;
    if (this.decelerated) this.trough = Math.min(this.trough, magnitude);
    this.lastMagnitude = magnitude;
    if (this.committed) return 0;
    this.intent += magnitude;
    if (this.intent < 42) return 0;
    this.intent = 0;
    this.committed = true;
    this.committedAt = now;
    return direction;
  }
}

export function nextCheckpoint(stops: number[], position: number, direction: number) {
  return direction > 0
    ? stops.find(stop => stop > position + STOP_EPSILON) ?? stops[stops.length - 1]
    : [...stops].reverse().find(stop => stop < position - STOP_EPSILON) ?? stops[0];
}
