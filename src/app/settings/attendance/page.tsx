import { AppShell } from "@/components/app-shell";
import { AttendanceSites } from "@/components/access/attendance-sites";

export const metadata = { title: "Attendance sites — Northstar People" };

export default function Page() {
  return <AppShell><AttendanceSites /></AppShell>;
}
