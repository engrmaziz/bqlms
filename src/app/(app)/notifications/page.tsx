import { redirect } from "next/navigation";
import { getActor } from "@/lib/auth/session";
import { listUserNotifications } from "@/modules/notifications";
import { NotificationsView } from "./notifications-view";

export default async function NotificationsPage() {
  const actor = await getActor();
  if (!actor) {
    redirect("/sign-in");
  }

  const notifications = await listUserNotifications(actor.userId, 50);

  return <NotificationsView notifications={notifications} />;
}
