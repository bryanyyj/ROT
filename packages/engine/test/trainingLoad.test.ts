import { describe, it, expect } from "vitest";
import {
  mean,
  stdDev,
  ewma,
  clamp,
  computeAcwr,
  computeLoad,
  hrvBaseline,
} from "../src/trainingLoad.js";

describe("basic maths helpers", () => {
  it("mean", () => {
    expect(mean([1, 2, 3])).toBe(2);
    expect(mean([])).toBe(0);
  });

  it("sample stdDev (n-1)", () => {
    // classic set: mean 5, sum of squared deviations 32, /7
    expect(stdDev([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2.138, 3);
    expect(stdDev([5])).toBe(0);
  });

  it("clamp", () => {
    expect(clamp(120, 0, 100)).toBe(100);
    expect(clamp(-5, 0, 100)).toBe(0);
    expect(clamp(50, 0, 100)).toBe(50);
  });
});

describe("EWMA / CTL / ATL [EV-002]", () => {
  it("single value seeds from 0", () => {
    expect(ewma([10], 7)).toBeCloseTo(1.4286, 4);
  });

  it("two values compound", () => {
    // x1 = 10/7 = 1.4286 ; x2 = 1.4286 + (10 - 1.4286)/7
    expect(ewma([10, 10], 7)).toBeCloseTo(2.6531, 4);
  });

  it("sustained constant load: ATL reacts faster so TSB is negative while CTL catches up", () => {
    const { ctl, atl, tsb } = computeLoad(Array(60).fill(50));
    expect(atl).toBeGreaterThan(ctl); // 7-day avg nearer the load than 42-day avg
    expect(tsb).toBeLessThan(0);
  });

  it("very long constant load: CTL and ATL both converge, TSB ~ 0", () => {
    const { ctl, atl, tsb } = computeLoad(Array(400).fill(50));
    expect(ctl).toBeCloseTo(50, 0);
    expect(atl).toBeCloseTo(50, 0);
    expect(Math.abs(tsb)).toBeLessThan(1);
  });
});

describe("ACWR [EV-003]", () => {
  it("is undefined with fewer than 7 days", () => {
    expect(computeAcwr([50, 50, 50, 50, 50, 50])).toBeUndefined();
  });

  it("equals 1.0 for steady load", () => {
    expect(computeAcwr(Array(28).fill(50))).toBeCloseTo(1.0, 5);
  });

  it("detects a spike above the danger threshold (>=1.5)", () => {
    // 21 days @40 then 7 days @80: acute 80, chronic 50 -> 1.6
    const loads = [...Array(21).fill(40), ...Array(7).fill(80)];
    expect(computeAcwr(loads)).toBeCloseTo(1.6, 5);
  });
});

describe("HRV baseline / SWC [EV-005]", () => {
  it("baseline is the mean, swc is 0.5*SD, rolling is last-7 mean", () => {
    const { baseline, swc, rolling } = hrvBaseline([4, 4, 4, 4, 4, 4, 4]);
    expect(baseline).toBe(4);
    expect(swc).toBe(0);
    expect(rolling).toBe(4);
  });
});
