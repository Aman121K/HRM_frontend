import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ModulePage } from "@/components/module-page";
import { modules, type ModuleKey } from "@/lib/modules";
export function generateStaticParams() {
  return Object.keys(modules)
    .filter((module) => !["my-space","performance","payroll","expenses","learning","hiring","exit-separation","reports","onboarding"].includes(module))
    .map((module) => ({ module }));
}
export default async function Page({
  params,
}: {
  params: Promise<{ module: string }>;
}) {
  const { module } = await params;
  const moved: Record<string, string> = { hiring: "/jobs", "exit-separation": "/exit" };
  if (moved[module]) redirect(moved[module]);
  const data = modules[module as ModuleKey];
  if (!data) notFound();
  return (
    <AppShell>
      <ModulePage data={data} />
    </AppShell>
  );
}
