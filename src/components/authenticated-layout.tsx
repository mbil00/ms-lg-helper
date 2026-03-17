"use client";

import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { AppSidebar } from "@/components/app-sidebar";
import { ListPanel } from "@/components/list-panel";
import { ListPanelToggle } from "@/components/list-panel-toggle";
import { Skeleton } from "@/components/ui/skeleton";

export function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { status } = useSession();

  if (status === "loading") {
    return (
      <div className="flex h-screen items-center justify-center">
        <Skeleton className="h-8 w-48" />
      </div>
    );
  }

  if (status === "unauthenticated") {
    redirect("/login");
  }

  return (
    <div className="flex h-screen">
      <AppSidebar />
      <main className="relative flex-1 overflow-auto">{children}</main>
      <ListPanelToggle />
      <ListPanel />
    </div>
  );
}
