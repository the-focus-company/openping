import { DashboardShell } from "@/components/layout/DashboardShell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // TODO: Enable WorkOS auth once @workos-inc/authkit-nextjs is wired up.
  return <DashboardShell>{children}</DashboardShell>;
}
