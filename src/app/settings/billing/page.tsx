import { AppShell } from "@/components/app-shell";
import { OwnerBilling } from "@/components/billing/owner-billing";

export const metadata = { title: "Plan & billing — Northstar People" };

export default function Page() {
  return <AppShell><OwnerBilling /></AppShell>;
}
