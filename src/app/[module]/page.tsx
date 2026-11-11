import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { modules, type ModuleKey } from "@/lib/modules";
export function generateStaticParams() {
  return Object.keys(modules)
    .filter((module) => !["my-space","performance","payroll","expenses","learning","hiring","exit-separation","reports","onboarding"].includes(module))
    .map((module) => ({ module }));
}
/** Modules without a live backend yet: an honest "not set up" page instead of sample data. */
export default async function Page({ params }: { params: Promise<{ module: string }> }) {
  const { module } = await params;
  const moved: Record<string, string> = { hiring: "/jobs", "exit-separation": "/exit", people: "/directory" };
  if (moved[module]) redirect(moved[module]);
  const data = modules[module as ModuleKey];
  if (!data) notFound();
  return (
    <AppShell>
      <div className="core-page">
        <header className="core-heading">
          <div>
            <p className="eyebrow">{data.eyebrow}</p>
            <h1>{data.title}</h1>
            <p>This module isn’t set up for your organisation yet. Nothing here is live data.</p>
          </div>
        </header>
        <p><Link className="core-primary" href="/">Back to home</Link></p>
      </div>
    </AppShell>
  );
}
