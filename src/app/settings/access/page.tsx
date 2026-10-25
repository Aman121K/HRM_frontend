import { AppShell } from "@/components/app-shell";
import { AccessWorkspace } from "@/components/access/access-workspace";

export const metadata = { title: "Access & roles — Northstar People" };

export default function Page() {
  return <AppShell><AccessWorkspace /></AppShell>;
}
