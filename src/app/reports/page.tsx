import { Suspense } from "react";
import { AppShell } from "@/components/app-shell";
import { ExecutiveOverview } from "@/components/analytics/overview";

export default function Page() {
  return <AppShell><Suspense fallback={<div className="cw-page"><div className="cw-hero-skeleton" aria-label="Loading" /></div>}><ExecutiveOverview /></Suspense></AppShell>;
}
