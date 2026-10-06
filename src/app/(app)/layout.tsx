import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { AppSidebar } from "@/components/app/app-sidebar";
import { BottomNav } from "@/components/app/bottom-nav";
import { getActor } from "@/lib/auth/session";
import { getMessages } from "@/lib/i18n";
import { getNavigationForActor, resolveActiveRole } from "@/lib/nav";
import { TanStackQueryProvider } from "@/lib/query-client";

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

          {/* Desktop Sidebar (md+) */}
          <AppSidebar
            actor={actor}
            activeRole={activeRole}
            items={navConfig.items}
            portalTitle={navConfig.title}
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
