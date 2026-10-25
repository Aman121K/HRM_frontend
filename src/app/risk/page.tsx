import { AppShell } from "@/components/app-shell";
import { RiskCenter } from "@/components/risk/risk-center";

export const metadata = { title: "Risk & Compliance — Northstar People" };

export default function Page() {
  return <AppShell><RiskCenter /></AppShell>;
}
