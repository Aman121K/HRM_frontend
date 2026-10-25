import { AppShell } from "@/components/app-shell";
import { RunReview } from "@/components/payroll-engine/run-review";

export default async function Page({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  return <AppShell><RunReview id={runId} /></AppShell>;
}
