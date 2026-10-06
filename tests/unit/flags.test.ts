import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { isEnabled, isKillSwitchActive } from "@/lib/flags";
import { clearSettingsCache } from "@/modules/settings";

describe("flags", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    clearSettingsCache();
  });

  afterEach(() => {
    process.env = originalEnv;
    clearSettingsCache();
  });

  it("detects active kill switch via KILL_<PROVIDER>=1", () => {
    process.env.KILL_OPENAI = "1";
    expect(isKillSwitchActive("openai")).toBe(true);
    expect(isKillSwitchActive("OPENAI")).toBe(true);
    expect(isKillSwitchActive("resend")).toBe(false);
  });

  it("prioritizes kill switch over settings flags in isEnabled", async () => {
    process.env.KILL_AIASSISTANCE = "1";
    const enabled = await isEnabled("aiAssistance");
    expect(enabled).toBe(false);
  });
});
