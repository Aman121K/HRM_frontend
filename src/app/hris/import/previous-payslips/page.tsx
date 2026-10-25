import {AppShell} from "@/components/app-shell";
import {ImportedPayslips} from "@/components/imports/switch-over";
/** Employee self-service: payslips issued by the previous payroll system (switch-over import). */
export default function Page(){return <AppShell><div className="so-page"><ImportedPayslips/></div></AppShell>}
