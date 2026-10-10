import { describe, expect, it } from "vitest";
import { verifyTaskDeterministic } from "./taskVerification";

describe("verifyTaskDeterministic", () => {
  it("rejects empty titles", () => {
    expect(verifyTaskDeterministic("", "INFO 1101").academic).toBe(false);
    expect(verifyTaskDeterministic("   ", "INFO 1101").academic).toBe(false);
  });

  it("rejects tasks without a course code", () => {
    expect(verifyTaskDeterministic("Lab 1", null).academic).toBe(false);
    expect(verifyTaskDeterministic("Math Homework", "").academic).toBe(false);
  });

  it("rejects personal chores", () => {
    const res = verifyTaskDeterministic("clean room", "INFO 1101");
    expect(res.academic).toBe(false);
    expect(res.bullshit).toBe(true);
    expect(verifyTaskDeterministic("do laundry", "INFO 1101").bullshit).toBe(true);
    expect(verifyTaskDeterministic("wash dishes", "INFO 1101").bullshit).toBe(true);
    expect(verifyTaskDeterministic("grocery shopping", "INFO 1101").bullshit).toBe(true);
  });

  it("rejects video games and gaming", () => {
    const res = verifyTaskDeterministic("play valorant", "INFO 1101");
    expect(res.academic).toBe(false);
    expect(res.bullshit).toBe(true);
    expect(verifyTaskDeterministic("minecraft building session", "INFO 1101").bullshit).toBe(true);
    expect(verifyTaskDeterministic("fifa tournament with friends", "INFO 1101").bullshit).toBe(true);
  });

  it("rejects media and entertainment", () => {
    expect(verifyTaskDeterministic("watch anime", "INFO 1101").bullshit).toBe(true);
    expect(verifyTaskDeterministic("binge netflix series", "INFO 1101").bullshit).toBe(true);
    expect(verifyTaskDeterministic("scroll tiktok for 2 hours", "INFO 1101").bullshit).toBe(true);
  });

  it("rejects sleep and leisure", () => {
    expect(verifyTaskDeterministic("sleep 8 hours", "INFO 1101").bullshit).toBe(true);
    expect(verifyTaskDeterministic("afternoon nap", "INFO 1101").bullshit).toBe(true);
    expect(verifyTaskDeterministic("gym leg day", "INFO 1101").bullshit).toBe(true);
    expect(verifyTaskDeterministic("workout routine", "INFO 1101").bullshit).toBe(true);
  });

  it("rejects blatant cheats and spam", () => {
    expect(verifyTaskDeterministic("free elo please", "INFO 1101").bullshit).toBe(true);
    expect(verifyTaskDeterministic("fake task test", "INFO 1101").bullshit).toBe(true);
  });

  it("distinguishes personal unranked to-dos from bullshit bums", () => {
    const res = verifyTaskDeterministic("Buy notebook", null);
    expect(res.academic).toBe(false);
    expect(res.bullshit).toBe(false);
  });

  it("accepts valid coursework tasks", () => {
    expect(verifyTaskDeterministic("Lab 1 Packet Tracer", "INFO 1101").academic).toBe(true);
    expect(verifyTaskDeterministic("Assignment 2 submission", "INFO 2302").academic).toBe(true);
    expect(verifyTaskDeterministic("Chapter 4 slides review", "MATH 1001").academic).toBe(true);
    expect(verifyTaskDeterministic("Midterm exam preparation", "CS 2103").academic).toBe(true);
    expect(verifyTaskDeterministic("Problem set 3", "MATH 1001").academic).toBe(true);
    expect(verifyTaskDeterministic("Quiz 1", "INFO 1101").academic).toBe(true);
  });

  it("allows words like 'game' or 'clean' when qualified by academic keywords", () => {
    expect(verifyTaskDeterministic("Game Development Unity project", "CS 3101").academic).toBe(true);
    expect(verifyTaskDeterministic("Clean Architecture case study essay", "INFO 2302").academic).toBe(true);
    expect(verifyTaskDeterministic("Film Studies critique report", "COMM 1001").academic).toBe(true);
  });

  it("allows culinary activities for culinary course codes", () => {
    expect(verifyTaskDeterministic("Bake chocolate cake", "CCBS 1010").academic).toBe(true);
    expect(verifyTaskDeterministic("Pasta cooking practical", "CCCK 1010").academic).toBe(true);
  });
});
