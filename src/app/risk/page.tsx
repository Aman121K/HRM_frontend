import { AppShell } from "@/components/app-shell";
import { RiskCenter } from "@/components/risk/risk-center";

export const metadata = { title: "Risk & Compliance — ClanChief" };

export default function Page() {
  return <AppShell><RiskCenter /></AppShell>;
}
