import { Suspense } from "react";
import { AppShell } from "@/components/app-shell";
import { PayslipView } from "@/components/payroll-engine/payslip-view";

export default async function Page({ params }: { params: Promise<{ period: string }> }) {
  const { period } = await params;
  return <AppShell><Suspense fallback={null}><PayslipView period={period} /></Suspense></AppShell>;
}
