import { Suspense } from "react";
import { AppShell } from "@/components/app-shell";
import { ReportView } from "@/components/analytics/report-view";

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <AppShell><Suspense fallback={<div className="cw-page"><div className="cw-hero-skeleton" aria-label="Loading" /></div>}><ReportView slug={slug} /></Suspense></AppShell>;
}
