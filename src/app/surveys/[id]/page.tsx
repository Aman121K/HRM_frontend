import { AppShell } from "@/components/app-shell";
import { SurveyTaker } from "@/components/engagement/survey-taker";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AppShell><SurveyTaker surveyId={id} /></AppShell>;
}
