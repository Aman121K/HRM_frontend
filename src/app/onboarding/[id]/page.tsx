import { AppShell } from "@/components/app-shell";
import { JoinerDetailPage } from "@/components/onboarding-flow/joiner-detail";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return <AppShell><JoinerDetailPage id={(await params).id} /></AppShell>;
}
