import { notFound } from "next/navigation";
import { PageHeader } from "@/components/app/page-header";
import { getActor } from "@/lib/auth/session";
import { getSettings } from "@/modules/settings";
import { SettingsForm } from "./settings-form";

export default async function AdminSettingsPage() {
  const actor = await getActor();

  // Settings modification is restricted strictly to super_admin
  if (!actor || !actor.roles.includes("super_admin")) {
    notFound();
  }

  const settings = await getSettings();

  return (
    <div className="space-y-6">
      <PageHeader
        title="College Settings"
        description="Configure institutional identity, timezone, WCAG AA compliant branding, operational policies, and feature flags."
      />

      <SettingsForm initialSettings={settings} />
    </div>
  );
}
