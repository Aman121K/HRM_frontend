import { AppShell } from "@/components/app-shell";
import { ModulePage } from "@/components/module-page";
import { modules } from "@/lib/modules";

export default function Page() {
  return <AppShell><ModulePage data={modules.leave} /></AppShell>;
}
