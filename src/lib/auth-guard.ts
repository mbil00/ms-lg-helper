import { auth } from "@/lib/auth";
import { isAdminUser } from "@/lib/admin";
import { NextResponse } from "next/server";

export async function getAuthenticatedUser() {
  const session = await auth();
  if (!session?.user) {
    return null;
  }
  if (!session.user.upn && !session.user.email) {
    return null;
  }
  return session.user;
}

export function unauthorizedResponse() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export function forbiddenResponse() {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

export function userIsAdmin(user?: { upn?: string; email?: string | null } | null) {
  return isAdminUser(user);
}
