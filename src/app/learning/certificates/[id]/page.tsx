import { AppShell } from "@/components/app-shell";
import { CertificateView } from "@/components/lms/certificate-view";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AppShell><CertificateView id={id} /></AppShell>;
}
