import { api } from "./api.ts";
import { getSession } from "./auth.ts";

export interface CurrentUser {
  id: string;
  fullName: string;
  email: string;
  studentId?: string;
  role: "admin" | "treasurer" | "door" | "volunteer" | "member";
  isDemo: boolean;
}

export function redirectByRole(role: string): string {
  switch (role) {
    case "admin":
      return "/admin";
    case "treasurer":
      return "/treasurer";
    case "door":
      return "/door";
    case "volunteer":
      return "/volunteer";
    default:
      return "/dashboard";
  }
}

export async function checkAuthAndRole(
  allowedRoles?: string[]
): Promise<CurrentUser | null> {
  const session = await getSession();
  if (!session) {
    const currentPath = window.location.pathname + window.location.search;
    window.location.href = `/login?next=${encodeURIComponent(currentPath)}`;
    return null;
  }

  try {
    const user = await api<CurrentUser>("/me");
    if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
      window.location.href = "/403";
      return null;
    }
    return user;
  } catch {
    window.location.href = "/login";
    return null;
  }
}
