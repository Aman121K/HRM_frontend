"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Clipboard,
  Download,
  Expand,
  Focus,
  LocateFixed,
  Mail,
  MapPin,
  Minus,
  MoveHorizontal,
  RotateCcw,
  Search,
  Users,
  X,
} from "lucide-react";
import { httpRequest } from "@/lib/http-client";
import { useDialogFocus } from "@/lib/use-dialog-focus";

type Employee = {
  id: string; name: string; initials: string; title: string; department: string; location: string;
  email: string; number: string; managerId?: string; reports: string[];
};
type ApiEmployee = { id: string; employeeNumber: string; fullName: string; workEmail: string; department: string | null;
  designation: string | null; location: string | null; managerId: string | null; status: string };

// Filled from the live brand directory before the chart renders.
const ORG_ROOT = "__org";
let employees: Record<string, Employee> = {};
let rootEmployeeId = ORG_ROOT;
let allIds: string[] = [];
let branchIds: string[] = [];
let layers = 0;
let meId = "";

function buildTree(items: ApiEmployee[]) {
  const map: Record<string, Employee> = {};
  for (const e of items) {
    const initials = e.fullName.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
    map[e.id] = { id: e.id, name: e.fullName, initials, title: e.designation || "—", department: e.department || "General",
      location: e.location || "—", email: e.workEmail, number: e.employeeNumber, managerId: e.managerId || undefined, reports: [] };
  }
  const roots: string[] = [];
  for (const p of Object.values(map)) {
    if (p.managerId && map[p.managerId] && p.managerId !== p.id) map[p.managerId].reports.push(p.id);
    else { p.managerId = undefined; roots.push(p.id); }
  }
  for (const p of Object.values(map)) p.reports.sort((a, b) => map[a].name.localeCompare(map[b].name));
  roots.sort((a, b) => map[b].reports.length - map[a].reports.length || map[a].name.localeCompare(map[b].name));
  if (roots.length === 1) rootEmployeeId = roots[0];
  else {
    map[ORG_ROOT] = { id: ORG_ROOT, name: "Your organisation", initials: "ORG", title: `${roots.length} people at the top level`,
      department: "Company", location: "All locations", email: "", number: "", reports: roots };
    for (const r of roots) map[r].managerId = ORG_ROOT;
    rootEmployeeId = ORG_ROOT;
  }
  employees = map;
  allIds = Object.keys(map).filter((id) => id !== ORG_ROOT);
  branchIds = Object.keys(map).filter((id) => map[id].reports.length);
  const depth = (id: string, seen = 0): number => seen > 50 ? 0 : 1 + Math.max(0, ...map[id].reports.map((c) => depth(c, seen + 1)));
  layers = rootEmployeeId === ORG_ROOT ? depth(ORG_ROOT) - 1 : depth(rootEmployeeId);
}

/** Org chart of the signed-in brand: only that brand's active employees, wired by their manager. */
export function OrganizationChart() {
  const [state, setState] = useState<"loading" | "ready" | "empty" | "error">("loading");
  const [error, setError] = useState("");
  useEffect(() => {
    (async () => {
      try {
        const items: ApiEmployee[] = [];
        for (let offset = 0; offset < 5000; offset += 200) {
          const page = await httpRequest<{ items: ApiEmployee[]; total: number }>(`/api/v2/employees?limit=200&offset=${offset}`);
          items.push(...page.items);
          if (page.items.length < 200) break;
        }
        const me = await httpRequest<{ id: string }>("/api/v2/me").catch(() => null);
        meId = me?.id || "";
        const active = items.filter((e) => e.status === "ACTIVE");
        if (!active.length) { setState("empty"); return; }
        buildTree(active);
        setState("ready");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't load the organisation chart."); setState("error");
      }
    })();
  }, []);
  if (state === "loading") return <div className="org-page"><p className="org-results">Loading organisation chart…</p></div>;
  if (state === "error") return <div className="org-page"><p className="core-error">{error}</p></div>;
  if (state === "empty") return <div className="org-page"><p className="org-results">No active employees in this organisation yet.</p></div>;
  return <OrganizationChartView />;
}

function OrganizationChartView() {
  const [expanded, setExpanded] = useState(new Set(branchIds));
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Employee | null>(null);
  const [copied, setCopied] = useState(false);
  const drawerRef = useRef<HTMLElement>(null);
  const closeSelected = useCallback(() => setSelected(null), []);
  useDialogFocus(Boolean(selected), closeSelected, drawerRef);
  const canvas = useRef<HTMLDivElement>(null);
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q
      ? new Set(
          allIds.filter((id) => {
            const p = employees[id];
            return [p.name, p.title, p.department, p.location].some((v) =>
              v.toLowerCase().includes(q),
            );
          }),
        )
      : new Set<string>();
  }, [query]);
  const revealed = useMemo(() => {
    if (!query.trim()) return null;
    const r = new Set<string>();
    matches.forEach((id) => {
      let current: Employee | undefined = employees[id];
      while (current) {
        r.add(current.id);
        current = current.managerId ? employees[current.managerId] : undefined;
      }
    });
    return r;
  }, [matches, query]);
  const isOpen = (id: string) => revealed?.has(id) ?? expanded.has(id);
  const visible = useMemo(() => {
    const ids: string[] = [];
    const walk = (id: string) => {
      if (revealed && !revealed.has(id)) return;
      ids.push(id);
      if (isOpen(id)) employees[id].reports.forEach(walk);
    };
    walk(rootEmployeeId);
    return ids;
  }, [expanded, revealed]);
  const centerPerson = useCallback(
    (id: string, behavior: ScrollBehavior = "smooth") => {
      requestAnimationFrame(() => {
        const view = canvas.current;
        const card = view?.querySelector<HTMLElement>(`#person-${id}`);
        if (!view || !card) return;
        const viewBox = view.getBoundingClientRect();
        const cardBox = card.getBoundingClientRect();
        view.scrollTo({
          left:
            view.scrollLeft +
            (cardBox.left - viewBox.left) -
            (view.clientWidth - cardBox.width) / 2,
          top: Math.max(0, view.scrollTop + (cardBox.top - viewBox.top) - 34),
          behavior,
        });
      });
    },
    [],
  );
  useEffect(() => {
    centerPerson(rootEmployeeId, "auto");
    let timer: number;
    const resized = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => centerPerson(rootEmployeeId, "auto"), 80);
    };
    window.addEventListener("resize", resized);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("resize", resized);
    };
  }, [centerPerson]);
  const toggle = (id: string) =>
    setExpanded((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  const reset = () => {
    setQuery("");
    setExpanded(new Set(branchIds));
    setTimeout(() => centerPerson(rootEmployeeId), 50);
  };
  const clearSearch = () => {
    setQuery("");
    setTimeout(() => centerPerson(rootEmployeeId), 50);
  };
  const expandAll = () => {
    setExpanded(new Set(branchIds));
    setTimeout(() => centerPerson(rootEmployeeId), 50);
  };
  const focusMe = () => {
    if (!meId || !employees[meId]) return;
    setQuery(employees[meId].name);
    setTimeout(() => centerPerson(meId), 50);
  };
  const exportCsv = () => {
    const rows = [
      ["Organisation chart"],
      ["Employee ID", "Name", "Title", "Department", "Location", "Manager", "Email"],
      ...visible.filter((id) => id !== ORG_ROOT).map((id) => {
        const p = employees[id];
        return [
          p.number,
          p.name,
          p.title,
          p.department,
          p.location,
          p.managerId && p.managerId !== ORG_ROOT ? employees[p.managerId].name : "",
          p.email,
        ];
      }),
    ];
    const csv = rows
      .map((r) => r.map((v) => `"${v.replaceAll('"', '""')}"`).join(","))
      .join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "visible-organization.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const copy = async () => {
    if (!selected) return;
    try {
      await navigator.clipboard.writeText(selected.email);
    } catch {
      const t = document.createElement("textarea");
      t.value = selected.email;
      document.body.appendChild(t);
      t.select();
      document.execCommand("copy");
      t.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  return (
    <div className="org-page">
      <nav className="org-crumb" aria-label="Breadcrumb">
        <Link href="/">
          <ArrowLeft size={14} />
          Home
        </Link>
        <span>/</span>
        <Link href="/people">People</Link>
        <span>/</span>
        <b>Organization chart</b>
      </nav>
      <header className="org-heading">
        <div>
          <p className="eyebrow">
            PEOPLE MAP
          </p>
          <h1>Organization chart</h1>
          <p>
            Explore reporting lines, team structure and the people behind the
            work.
          </p>
        </div>
        <button className="org-primary" onClick={exportCsv}>
          <Download size={16} />
          <span>Export visible CSV</span>
        </button>
      </header>
      <section className="org-toolbar" aria-label="Chart controls">
        <label className="org-search">
          <Search size={17} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, role, team or location"
            aria-label="Search organization"
          />
          {query && (
            <button onClick={clearSearch} aria-label="Clear search">
              <X size={15} />
            </button>
          )}
        </label>
        <div className="org-actions">
          <button onClick={expandAll}>
            <Expand size={15} />
            Expand all
          </button>
          <button onClick={() => setExpanded(new Set())}>
            <Minus size={15} />
            Collapse all
          </button>
          <button onClick={focusMe}>
            <Focus size={15} />
            Focus on me
          </button>
          <button onClick={() => centerPerson(rootEmployeeId)}>
            <LocateFixed size={15} />
            Root
          </button>
          <button onClick={reset}>
            <RotateCcw size={15} />
            Reset
          </button>
        </div>
      </section>
      <div className="org-status">
        <div className="org-metrics">
          <span>
            <strong>{allIds.length}</strong>people
          </span>
          <span>
            <strong>{layers}</strong>layers
          </span>
          <span>
            <strong>
              {new Set(allIds.map((id) => employees[id].department)).size}
            </strong>
            departments
          </span>
          <span>
            <strong>
              {new Set(allIds.map((id) => employees[id].location)).size}
            </strong>
            locations
          </span>
        </div>
      </div>
      {query && (
        <p className="org-results" role="status">
          {matches.size
            ? `${matches.size} match${matches.size === 1 ? "" : "es"} · showing reporting paths`
            : `No people found for “${query}”`}
        </p>
      )}
      <div
        className="org-canvas"
        ref={canvas}
        tabIndex={0}
        aria-label="Scrollable organization hierarchy"
      >
        <span className="canvas-pan-cue">
          <MoveHorizontal size={14} />
          Drag or swipe to explore
        </span>
        {matches.size || !query ? (
          <OrgNode
            id={rootEmployeeId}
            expanded={isOpen}
            matches={matches}
            revealed={revealed}
            toggle={toggle}
            select={setSelected}
          />
        ) : (
          <div className="org-empty">
            <Search />
            <h2>No matching people</h2>
            <p>Try a name, department, role or office location.</p>
            <button onClick={clearSearch}>Clear search</button>
          </div>
        )}
      </div>
      <p className="org-hint">
        Select a card for contact details and direct reports. Use Root at any
        time to return to the executive level.
      </p>
      {selected && (
        <>
          <button
            className="drawer-backdrop"
            aria-label="Close employee details"
            onClick={closeSelected}
          />
          <aside
            className="record-drawer drawer-standard employee-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="employee-name"
            ref={drawerRef}
            tabIndex={-1}
          >
            <button
              className="drawer-close"
              onClick={closeSelected}
              aria-label="Close"
            >
              <X />
            </button>
            <div className="drawer-top">
              <span
                className={`drawer-avatar dept-${selected.department.toLowerCase().replaceAll(" ", "-")}`}
              >
                {selected.initials}
              </span>
              <p className="eyebrow">EMPLOYEE PROFILE</p>
              <h2 id="employee-name">{selected.name}</h2>
              <p>{selected.title}</p>
            </div>
            <dl className="employee-facts">
              <div>
                <dt>Department</dt>
                <dd>{selected.department}</dd>
              </div>
              <div>
                <dt>Location</dt>
                <dd>
                  <MapPin size={14} />
                  {selected.location}
                </dd>
              </div>
              <div>
                <dt>Manager</dt>
                <dd>
                  {selected.managerId && selected.managerId !== ORG_ROOT ? (
                    <button
                      onClick={() =>
                        setSelected(employees[selected.managerId!])
                      }
                    >
                      {employees[selected.managerId].name}
                    </button>
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
              <div>
                <dt>Direct reports</dt>
                <dd>{selected.reports.length}</dd>
              </div>
              <div>
                <dt>Email</dt>
                <dd>{selected.email}</dd>
              </div>
              <div>
                <dt>Employee ID</dt>
                <dd>{selected.number}</dd>
              </div>
            </dl>
            {selected.reports.length > 0 && (
              <div className="drawer-reports">
                <p className="eyebrow">DIRECT REPORTS</p>
                {selected.reports.map((id) => (
                  <button key={id} onClick={() => setSelected(employees[id])}>
                    <span>{employees[id].initials}</span>
                    {employees[id].name}
                    <ChevronRight size={14} />
                  </button>
                ))}
              </div>
            )}
            <div className="drawer-actions">
              <a href={`mailto:${selected.email}`}>
                <Mail size={16} />
                Email
              </a>
              <button onClick={copy}>
                <Clipboard size={16} />
                {copied ? "Copied" : "Copy email"}
              </button>
              <Link href="/directory">
                <Users size={16} />
                Open directory
              </Link>
            </div>
          </aside>
        </>
      )}
    </div>
  );
}

function OrgNode({
  id,
  expanded,
  matches,
  revealed,
  toggle,
  select,
}: {
  id: string;
  expanded: (id: string) => boolean;
  matches: Set<string>;
  revealed: Set<string> | null;
  toggle: (id: string) => void;
  select: (p: Employee) => void;
}) {
  const p = employees[id];
  const open = expanded(id);
  const kids = p.reports.filter((child) => !revealed || revealed.has(child));
  return (
    <div className="org-node">
      <div className="org-node-line">
        <button
          id={`person-${id}`}
          className={`person-card ${matches.has(id) ? "match" : ""}`}
          onClick={() => id !== ORG_ROOT && select(p)}
          aria-label={`Open details for ${p.name}`}
        >
          <span
            className={`person-avatar dept-${p.department.toLowerCase().replaceAll(" ", "-")}`}
          >
            {p.initials}
          </span>
          <span className="person-copy">
            <small>{p.department}</small>
            <strong>{p.name}</strong>
            <em>{p.title}</em>
            <span>
              <MapPin size={11} />
              {p.location}
            </span>
          </span>
        </button>
        {p.reports.length > 0 && (
          <button
            className="branch-toggle"
            onClick={() => toggle(id)}
            aria-label={`${open ? "Collapse" : "Expand"} ${p.name}'s team`}
            aria-expanded={open}
          >
            {open ? <ChevronDown /> : <ChevronRight />}
            <span>{p.reports.length}</span>
          </button>
        )}
      </div>
      {open && kids.length > 0 && (
        <div className="org-children">
          {kids.map((child) => (
            <OrgNode
              key={child}
              id={child}
              expanded={expanded}
              matches={matches}
              revealed={revealed}
              toggle={toggle}
              select={select}
            />
          ))}
        </div>
      )}
    </div>
  );
}
