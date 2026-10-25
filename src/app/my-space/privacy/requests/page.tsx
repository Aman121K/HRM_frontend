import { AppShell } from "@/components/app-shell";
import { CaseWorkspace } from "@/components/cases/case-workspace";

export default function PrivacyRequestsPage() {
  return <AppShell><CaseWorkspace moduleKey="privacy_request" /></AppShell>;
}
