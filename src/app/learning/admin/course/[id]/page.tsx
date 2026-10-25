import { AppShell } from "@/components/app-shell";
import { CourseBuilder } from "@/components/lms/course-builder";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AppShell><CourseBuilder courseId={id} /></AppShell>;
}
