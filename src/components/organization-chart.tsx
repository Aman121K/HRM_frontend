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
import { employees, rootEmployeeId, type Employee } from "@/lib/org-data";
import { tenant } from "@/lib/tenant";
import { useDialogFocus } from "@/lib/use-dialog-focus";

const allIds = Object.keys(employees);
const branchIds = allIds.filter((id) => employees[id].reports.length);

export function OrganizationChart() {
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
    setQuery("Vikas Tiwari");
    setTimeout(() => centerPerson("vikas-tiwari"), 50);
  };
  const exportCsv = () => {
    const rows = [
      ["Tenant", tenant.id],
      ["Name", "Title", "Department", "Location", "Manager", "Status", "Email"],
      ...visible.map((id) => {
        const p = employees[id];
        return [
          p.name,
          p.title,
          p.department,
          p.location,
          p.managerId ? employees[p.managerId].name : "",
          p.status,
          p.email,
        ];
      }),
    ];
    const csv = rows
      .map((r) => r.map((v) => `"${v.replaceAll('"', '""')}"`).join(","))
      .join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `${tenant.displayName.toLowerCase().replaceAll(" ", "-")}-visible-organization.csv`;
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
            PEOPLE MAP · {tenant.displayName.toUpperCase()}
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
            <strong>4</strong>layers
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
        <div className="org-legend">
          <span>
            <i className="legend-dot present" />
            Present
          </span>
          <span>
            <i className="legend-dot remote" />
            Remote
          </span>
          <span>
            <i className="legend-dot away" />
            Away
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
              <span className={`status-chip ${selected.status.toLowerCase()}`}>
                {selected.status}
              </span>
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
                  {selected.managerId ? (
                    <button
                      onClick={() =>
                        setSelected(employees[selected.managerId!])
                      }
                    >
                      {employees[selected.managerId].name}
                    </button>
                  ) : (
                    "Board of Directors"
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
                <dt>Phone</dt>
                <dd>{selected.phone}</dd>
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
              <Link href={`/people/${selected.id}`}>
                <Users size={16} />
                View profile
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
          onClick={() => select(p)}
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
              {p.location} ·{" "}
              <i className={`legend-dot ${p.status.toLowerCase()}`} />
              {p.status}
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
