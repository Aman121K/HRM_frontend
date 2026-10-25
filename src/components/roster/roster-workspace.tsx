"use client";
import { AlertTriangle, CalendarRange, Settings2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { MyRosterView } from "./my-roster";
import { RosterPlanner } from "./roster-planner";
import { rosterApi, type Context } from "./roster-api";
import { TemplatesDrawer } from "./templates-drawer";

type Tab = "plan" | "mine";

export function RosterWorkspace() {
  const [context, setContext] = useState<Context | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("plan");
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [revision, setRevision] = useState(0);

  const load = useCallback(() => {
    setError("");
    rosterApi.context().then(setContext).catch((reason: Error) => setError(reason.message || "Could not load the roster."));
  }, []);
  useEffect(load, [load]);

  if (error) return (
    <div className="cw-page ro-page">
      <p className="cw-alert" role="alert"><AlertTriangle size={15} /> {error} Make sure the platform API is running.</p>
      <button className="cw-btn ghost" onClick={load}>Try again</button>
    </div>
  );
  if (!context) return <div className="cw-page ro-page"><div className="cw-hero-skeleton" aria-label="Loading roster" /><div className="cw-list-skeleton" style={{ marginTop: 18 }}><i /><i /><i /></div></div>;

  const { viewer } = context;
  const planner = viewer.canPlan;
  const active: Tab = planner ? tab : "mine";

  return (
    <div className="cw-page ro-page" style={{ ["--accent" as string]: "#8a5a2b" }}>
      <header className="cw-hero">
        <span className="cw-hero-icon"><CalendarRange size={26} strokeWidth={1.7} /></span>
        <div>
          <p className="cw-eyebrow">TIME · SHIFT ROSTER</p>
          <h1>{active === "plan" ? "Roster planner" : "My roster"}</h1>
          <p>{active === "plan"
            ? `Plan opening, mid and closing shifts${viewer.isHr ? " for any team" : " for your team"}. Leave, rest gaps, weekly hours, weekly offs and coverage are checked as you plan.`
            : "Your published shifts for this week and next. Changes appear here once your manager publishes them."}</p>
        </div>
        {viewer.isHr && <button className="cw-btn ghost lg" onClick={() => setTemplatesOpen(true)}><Settings2 size={17} /> Shift templates</button>}
      </header>

      {planner && (
        <div className="cw-toolbar ro-tabs">
          <div className="cw-tabs" role="tablist" aria-label="Roster views">
            <button role="tab" aria-selected={active === "plan"} className={active === "plan" ? "active" : ""} onClick={() => setTab("plan")}>Plan roster</button>
            <button role="tab" aria-selected={active === "mine"} className={active === "mine" ? "active" : ""} onClick={() => setTab("mine")}>My roster</button>
          </div>
        </div>
      )}

      {active === "plan" ? <RosterPlanner context={context} revision={revision} /> : <MyRosterView />}

      {templatesOpen && (
        <TemplatesDrawer onClose={() => setTemplatesOpen(false)} onChanged={() => { load(); setRevision((value) => value + 1); }} />
      )}
    </div>
  );
}
