import { Suspense } from "react";
import { AppShell } from "@/components/app-shell";
import { SalaryStructures } from "@/components/payroll-engine/structures";

export default function Page() {
  return <AppShell><Suspense fallback={null}><SalaryStructures /></Suspense></AppShell>;
}
