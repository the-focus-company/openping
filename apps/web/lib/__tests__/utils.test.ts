import { describe, it, expect } from "vitest";
import { cn, avatarGradient, formatRelativeTime } from "../utils";

describe("cn", () => {
  it("merges multiple class strings", () => {
    expect(cn("px-2", "py-1")).toBe("px-2 py-1");
  });

  it("handles conditional classes", () => {
    expect(cn("base", false && "hidden", "visible")).toBe("base visible");
  });

  it("deduplicates conflicting Tailwind classes", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });

  it("handles empty inputs", () => {
    expect(cn()).toBe("");
  });

  it("handles undefined and null inputs", () => {
    expect(cn("a", undefined, null, "b")).toBe("a b");
  });
});

describe("avatarGradient", () => {
  it("returns a consistent gradient for the same seed", () => {
    const first = avatarGradient("user-123");
    const second = avatarGradient("user-123");
    expect(first).toBe(second);
  });

  it("returns different gradients for different seeds", () => {
    const a = avatarGradient("alice");
    const b = avatarGradient("bob");
    // While collisions are theoretically possible, these two seeds produce different hashes
    expect(a).not.toBe(b);
  });

  it("always returns a valid gradient string", () => {
    const seeds = ["a", "test", "user-999", "xyz", ""];
    for (const seed of seeds) {
      const result = avatarGradient(seed);
      expect(result).toMatch(/^from-\w+-\d+ to-\w+-\d+$/);
    }
  });
});

describe("formatRelativeTime", () => {
  it('returns "just now" for recent timestamps', () => {
    const now = Date.now();
    expect(formatRelativeTime(now - 5_000)).toBe("just now");
  });

  it('returns "Xm ago" for minutes', () => {
    const now = Date.now();
    expect(formatRelativeTime(now - 5 * 60_000)).toBe("5m ago");
  });

  it('returns "Xh ago" for hours', () => {
    const now = Date.now();
    expect(formatRelativeTime(now - 3 * 3_600_000)).toBe("3h ago");
  });

  it('returns "Xd ago" for days', () => {
    const now = Date.now();
    expect(formatRelativeTime(now - 2 * 86_400_000)).toBe("2d ago");
  });

  it('returns "in the future" for future dates', () => {
    const future = Date.now() + 60_000;
    expect(formatRelativeTime(future)).toBe("in the future");
  });

  it("accepts a Date object", () => {
    const date = new Date(Date.now() - 10 * 60_000);
    expect(formatRelativeTime(date)).toBe("10m ago");
  });

  it("returns a formatted date for timestamps older than 7 days", () => {
    const old = Date.now() - 10 * 86_400_000;
    const result = formatRelativeTime(old);
    // Should be something like "Mar 12" — contains a month abbreviation and a number
    expect(result).toMatch(/^[A-Z][a-z]{2} \d{1,2}$/);
  });
});
