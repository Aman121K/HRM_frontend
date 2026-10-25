import { AppShell } from "@/components/app-shell";
import { CaseWorkspace } from "@/components/cases/case-workspace";

export default function Page() {
  return <AppShell><CaseWorkspace moduleKey="shifts" /></AppShell>;
}
