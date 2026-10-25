import { AppShell } from "@/components/app-shell";
import { CoursePlayer } from "@/components/lms/course-player";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AppShell><CoursePlayer courseId={id} /></AppShell>;
}
