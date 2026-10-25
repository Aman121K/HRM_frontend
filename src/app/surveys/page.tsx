import { Suspense } from "react";
import { AppShell } from "@/components/app-shell";
import { SurveysHome } from "@/components/engagement/surveys-home";

export default function Page() {
  return <AppShell><Suspense fallback={<div className="cw-page"><div className="cw-hero-skeleton" aria-label="Loading" /></div>}><SurveysHome /></Suspense></AppShell>;
}
