import { AppShell } from "@/components/app-shell";
import { AttendanceSites } from "@/components/access/attendance-sites";

export const metadata = { title: "Attendance sites — ClanChief" };

export default function Page() {
  return <AppShell><AttendanceSites /></AppShell>;
}
