import { AppShell } from "@/components/app-shell";
import { SurveyBuilder } from "@/components/engagement/survey-builder";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AppShell><SurveyBuilder surveyId={id} /></AppShell>;
}
