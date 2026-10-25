import { AppShell } from "@/components/app-shell";
import { SurveyResults } from "@/components/engagement/survey-results";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AppShell><SurveyResults surveyId={id} /></AppShell>;
}
