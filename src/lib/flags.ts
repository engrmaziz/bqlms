import { getSettings } from "@/modules/settings";

export function isKillSwitchActive(key: string): boolean {
  const envKey = `KILL_${key.toUpperCase()}`;
  return process.env[envKey] === "1";
}

export async function isEnabled(key: string): Promise<boolean> {
  // 1. Env kill switches always take precedence
  if (isKillSwitchActive(key)) {
    return false;
  }

  // 2. Read feature flags from cached settings
  const settings = await getSettings();
  return Boolean(settings.flags[key]);
}
