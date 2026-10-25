import { AppShell } from "@/components/app-shell";
import { JobsConsole } from "@/components/jobs/jobs-console";

export const metadata = { title: "Jobs & automations — Northstar People" };

export default function Page() {
  return <AppShell><JobsConsole /></AppShell>;
}
