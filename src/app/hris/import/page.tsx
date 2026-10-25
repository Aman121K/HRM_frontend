import Link from "next/link";
import {AppShell} from "@/components/app-shell";import {EmployeeImportPage} from "@/components/core-hris";
import "@/components/imports/switch-over.css";
export default function Page(){return <AppShell><div className="so-banner"><span><b>Moving from PeopleStrong, Excel or another HRMS mid-year?</b><small>After the employee register, load master details, salaries, opening leave, payroll year-to-date and old payslips on the switch-over checklist.</small></span><Link className="so-btn primary" href="/hris/import/switch-over">Open switch-over checklist</Link></div><EmployeeImportPage/></AppShell>}
