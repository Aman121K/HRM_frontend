import { AppShell } from "@/components/app-shell";
import { SecuritySettings } from "@/components/auth/security-settings";

export const metadata = { title: "My security — Northstar People" };
export default function Page() {
  return <AppShell><SecuritySettings /></AppShell>;
}
