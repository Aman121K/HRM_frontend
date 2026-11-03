import { AppShell } from "@/components/app-shell";
import { SettingsHub } from "@/components/access/settings-hub";

export const metadata = { title: "Settings — ClanChief" };

export default function Page() {
  return <AppShell><SettingsHub /></AppShell>;
}
