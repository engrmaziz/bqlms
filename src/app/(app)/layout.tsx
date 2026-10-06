import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { AppSidebar } from "@/components/app/app-sidebar";
import { BottomNav } from "@/components/app/bottom-nav";
import { NotificationBell } from "@/components/app/notification-bell";
import { getActor } from "@/lib/auth/session";
import { getMessages } from "@/lib/i18n";
import { getNavigationForActor, resolveActiveRole } from "@/lib/nav";
import { TanStackQueryProvider } from "@/lib/query-client";
import { getUnreadNotificationsCount } from "@/modules/notifications";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const actor = await getActor();
  if (!actor) {
    redirect("/sign-in");
  }

  const cookieStore = await cookies();
  const cookieRole = cookieStore.get("bqlms_active_role")?.value;
  const activeRole = resolveActiveRole(actor, cookieRole);

  const navConfig = getNavigationForActor(actor, activeRole);
  const messages = getMessages();
  const unreadCount = await getUnreadNotificationsCount(actor.userId);

  return (
    <TanStackQueryProvider>
      <NextIntlClientProvider locale="en" messages={messages}>
        <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
          {/* Accessibility Skip Link */}
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-indigo-600 focus:text-white focus:rounded-lg focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-white"
          >
            Skip to main content
          </a>

          {/* Mobile Top Header (< md) */}
          <header className="flex md:hidden items-center justify-between px-4 h-14 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur sticky top-0 z-20">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-xs">
                BC
              </div>
              <span className="font-bold text-sm text-white truncate">
                {navConfig.title}
              </span>
            </div>
            <NotificationBell unreadCount={unreadCount} />
          </header>

          {/* Desktop Sidebar (md+) */}
          <AppSidebar
            actor={actor}
            activeRole={activeRole}
            items={navConfig.items}
            portalTitle={navConfig.title}
            unreadCount={unreadCount}
          />

          {/* Main Area */}
          <div className="md:pl-64 flex flex-col flex-1 min-h-screen">
            <main
              id="main-content"
              tabIndex={-1}
              className="flex-1 p-4 sm:p-6 lg:p-8 pb-24 md:pb-8 max-w-7xl w-full mx-auto focus:outline-none"
            >
              {children}
            </main>
          </div>

          {/* Mobile Bottom Navigation (< md) */}
          <BottomNav items={navConfig.items} />
        </div>
      </NextIntlClientProvider>
    </TanStackQueryProvider>
  );
}
