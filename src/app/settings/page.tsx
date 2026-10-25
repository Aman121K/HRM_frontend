import { AppShell } from "@/components/app-shell";
import { SettingsHub } from "@/components/access/settings-hub";

export const metadata = { title: "Settings — Northstar People" };

export default function Page() {
  return <AppShell><SettingsHub /></AppShell>;
}
