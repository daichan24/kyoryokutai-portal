import { describe, expect, it } from 'vitest';
import { calcWorkMinutes } from './leave';

describe('calcWorkMinutes', () => {
  it('keeps constraint time unchanged below 6 hours (no break)', () => {
    expect(calcWorkMinutes(330)).toBe(330); // 5h30m
    expect(calcWorkMinutes(359)).toBe(359); // 5h59m
  });

  it('subtracts a 1 hour break at 6 hours and above', () => {
    expect(calcWorkMinutes(360)).toBe(300); // 6h00m -> 5h00m
    expect(calcWorkMinutes(390)).toBe(330); // 6h30m -> 5h30m
    expect(calcWorkMinutes(540)).toBe(480); // 9h00m -> 8h00m
  });

  it('never credits less work time than a shorter shift below the break threshold', () => {
    // Regression: constraint minutes just past 5h30m used to drop straight to
    // (constraint - 60), crediting *less* work time than a 5h30m shift. The
    // break should only kick in once the shift actually reaches 6 hours.
    for (let minutes = 1; minutes < 360; minutes += 1) {
      expect(calcWorkMinutes(minutes)).toBe(minutes);
    }
  });

  it('is monotonically non-decreasing once past the 6-hour break threshold', () => {
    let previous = calcWorkMinutes(360);
    for (let minutes = 361; minutes <= 600; minutes += 1) {
      const current = calcWorkMinutes(minutes);
      expect(current).toBeGreaterThanOrEqual(previous);
      previous = current;
    }
  });
});
