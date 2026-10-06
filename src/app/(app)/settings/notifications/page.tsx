import { redirect } from "next/navigation";
import { getActor } from "@/lib/auth/session";
import { getUserPreferences } from "@/modules/notifications";
import { NotificationPreferencesForm } from "./notification-preferences-form";

export default async function NotificationPreferencesPage() {
  const actor = await getActor();
  if (!actor) {
    redirect("/sign-in");
  }

  const preferences = await getUserPreferences(actor.userId);

  return <NotificationPreferencesForm initialPreferences={preferences} />;
}
