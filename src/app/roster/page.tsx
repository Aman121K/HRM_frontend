import { AppShell } from "@/components/app-shell";
import { RosterWorkspace } from "@/components/roster/roster-workspace";

export const metadata = { title: "Roster — ClanChief" };

export default function Page() {
  return <AppShell><RosterWorkspace /></AppShell>;
}
