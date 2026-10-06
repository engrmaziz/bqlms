import type { Actor } from "@/lib/auth/session";
import type { Role } from "@/modules/identity/schema";

export interface NavItem {
  title: string;
  href: string;
  iconName:
    | "dashboard"
    | "users"
    | "settings"
    | "courses"
    | "grades"
    | "assignments";
  exact?: boolean;
}

export interface PortalConfig {
  portal: "admin" | "faculty" | "student";
  basePath: string;
  title: string;
  items: NavItem[];
}

export function resolveActiveRole(
  actor: Actor,
  cookieRole?: string | null,
): Role {
  if (cookieRole && actor.roles.includes(cookieRole as Role)) {
    return cookieRole as Role;
  }
  // Default hierarchy
  if (actor.roles.includes("super_admin")) return "super_admin";
  if (actor.roles.includes("admin")) return "admin";
  if (actor.roles.includes("registrar")) return "registrar";
  if (actor.roles.includes("faculty")) return "faculty";
  return "student";
}

export function getPortalForRole(role: Role): "admin" | "faculty" | "student" {
  if (role === "super_admin" || role === "admin" || role === "registrar") {
    return "admin";
  }
  if (role === "faculty") {
    return "faculty";
  }
  return "student";
}

export function getNavigationForActor(
  _actor: Actor,
  activeRole: Role,
): PortalConfig {
  const portal = getPortalForRole(activeRole);

  if (portal === "admin") {
    const items: NavItem[] = [
      {
        title: "Overview",
        href: "/admin",
        iconName: "dashboard",
        exact: true,
      },
      {
        title: "Users",
        href: "/admin/users",
        iconName: "users",
      },
    ];

    if (activeRole === "super_admin") {
      items.push({
        title: "Settings",
        href: "/admin/settings",
        iconName: "settings",
      });
    }

    return {
      portal: "admin",
      basePath: "/admin",
      title: "Administration",
      items,
    };
  }

  if (portal === "faculty") {
    return {
      portal: "faculty",
      basePath: "/faculty",
      title: "Faculty Portal",
      items: [
        {
          title: "My Sections",
          href: "/faculty",
          iconName: "courses",
          exact: true,
        },
      ],
    };
  }

  return {
    portal: "student",
    basePath: "/student",
    title: "Student Portal",
    items: [
      {
        title: "Dashboard",
        href: "/student",
        iconName: "dashboard",
        exact: true,
      },
    ],
  };
}
