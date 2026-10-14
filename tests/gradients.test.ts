/**
 * Unit tests for CSS gradient parsing and Figma GradientPaint construction.
 * Pure logic — no Figma or WebSocket connection required:
 *   bun test tests/gradients.test.ts
 */

import { describe, test, expect } from "bun:test";
import { parseCssGradient, buildGradientPaint, isGradientValue } from "../src/claude_figma_plugin/src/utils";

describe("isGradientValue", () => {
  test("detects CSS gradient strings", () => {
    expect(isGradientValue("linear-gradient(90deg, #fff, #000)")).toBe(true);
    expect(isGradientValue("radial-gradient(#fff, #000)")).toBe(true);
  });

  test("detects gradient objects", () => {
    expect(isGradientValue({ stops: [{ position: 0, color: "#fff" }] })).toBe(true);
  });

  test("rejects solids and variable refs", () => {
    expect(isGradientValue("#3d6daa")).toBe(false);
    expect(isGradientValue("$var:Colors/Primary")).toBe(false);
    expect(isGradientValue({ r: 1, g: 0, b: 0 })).toBe(false);
    expect(isGradientValue(null)).toBe(false);
  });
});

describe("parseCssGradient", () => {
  test("parses angle and hex stops with positions", () => {
    const g = parseCssGradient("linear-gradient(135deg, #667eea 0%, #764ba2 100%)");
    expect(g.type).toBe("GRADIENT_LINEAR");
    expect(g.angle).toBe(135);
    expect(g.stops.length).toBe(2);
    expect(g.stops[0].position).toBe(0);
    expect(g.stops[1].position).toBe(1);
    expect(g.stops[0].color.r).toBeCloseTo(0x66 / 255);
  });

  test("defaults to 180deg (to bottom) with no direction", () => {
    const g = parseCssGradient("linear-gradient(#fff, #000)");
    expect(g.angle).toBe(180);
  });

  test("maps side keywords to angles", () => {
    expect(parseCssGradient("linear-gradient(to right, #fff, #000)").angle).toBe(90);
    expect(parseCssGradient("linear-gradient(to top left, #fff, #000)").angle).toBe(315);
  });

  test("parses rgba() stops including commas inside parens", () => {
    const g = parseCssGradient("linear-gradient(90deg, rgba(255, 0, 0, 0.5) 0%, rgb(0, 0, 255) 100%)");
    expect(g.stops.length).toBe(2);
    expect(g.stops[0].color.r).toBeCloseTo(1);
    expect(g.stops[0].color.a).toBeCloseTo(0.5);
    expect(g.stops[1].color.b).toBeCloseTo(1);
  });

  test("interpolates missing interior positions", () => {
    const g = parseCssGradient("linear-gradient(90deg, #fff, #888, #000)");
    expect(g.stops[0].position).toBe(0);
    expect(g.stops[1].position).toBeCloseTo(0.5);
    expect(g.stops[2].position).toBe(1);
  });

  test("parses radial gradients, dropping shape prelude", () => {
    const g = parseCssGradient("radial-gradient(circle at center, #fff 0%, #000 100%)");
    expect(g.type).toBe("GRADIENT_RADIAL");
    expect(g.stops.length).toBe(2);
  });

  test("returns null on garbage", () => {
    expect(parseCssGradient("not-a-gradient(#fff)")).toBe(null);
    expect(parseCssGradient("linear-gradient(#fff)")).toBe(null); // only one stop
    expect(parseCssGradient("linear-gradient(90deg, bogus, #000)")).toBe(null);
  });
});

describe("buildGradientPaint", () => {
  test("90deg (to right) yields identity transform", () => {
    const paint = buildGradientPaint("linear-gradient(90deg, #fff, #000)");
    expect(paint.type).toBe("GRADIENT_LINEAR");
    const t = paint.gradientTransform;
    expect(t[0][0]).toBeCloseTo(1);
    expect(t[0][1]).toBeCloseTo(0);
    expect(t[0][2]).toBeCloseTo(0);
    expect(t[1][0]).toBeCloseTo(0);
    expect(t[1][1]).toBeCloseTo(1);
    expect(t[1][2]).toBeCloseTo(0);
  });

  test("180deg (to bottom) maps top edge to start, bottom edge to end", () => {
    const t = buildGradientPaint("linear-gradient(180deg, #fff, #000)").gradientTransform;
    // gradient-space x for a point (x, y): t[0][0]*x + t[0][1]*y + t[0][2]
    const gxTop = t[0][0] * 0.5 + t[0][1] * 0 + t[0][2];
    const gxBottom = t[0][0] * 0.5 + t[0][1] * 1 + t[0][2];
    expect(gxTop).toBeCloseTo(0);
    expect(gxBottom).toBeCloseTo(1);
  });

  test("accepts object specs with hex stop colors", () => {
    const paint = buildGradientPaint({
      angle: 45,
      stops: [
        { position: 0, color: "#ff0000" },
        { position: 1, color: { r: 0, g: 0, b: 1 } },
      ],
    });
    expect(paint.gradientStops[0].color.r).toBeCloseTo(1);
    expect(paint.gradientStops[1].color.b).toBeCloseTo(1);
    expect(paint.gradientStops[1].color.a).toBe(1);
  });

  test("radial gets identity-style transform", () => {
    const paint = buildGradientPaint("radial-gradient(#fff, #000)");
    expect(paint.type).toBe("GRADIENT_RADIAL");
    expect(paint.gradientTransform).toEqual([[1, 0, 0], [0, 1, 0]]);
  });

  test("returns null for unparseable input", () => {
    expect(buildGradientPaint("linear-gradient(oops)")).toBe(null);
    expect(buildGradientPaint({ stops: [{ position: 0, color: "#fff" }] })).toBe(null);
  });
});
