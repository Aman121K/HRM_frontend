"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Briefcase,
  CalendarDays,
  Check,
  Download,
  FileText,
  HeartPulse,
  Laptop,
  LockKeyhole,
  Mail,
  MapPin,
  Pencil,
  ShieldCheck,
  Upload,
  Users,
  X,
} from "lucide-react";
import {
  currentEmployee as fixtureEmployee,
  employeeDocuments,
  type PreviewableEmployeeDocument,
} from "@/lib/current-employee";
import { tenant } from "@/lib/tenant";
import { useDialogFocus } from "@/lib/use-dialog-focus";
import {httpRequest} from "@/lib/http-client";
const e=fixtureEmployee;

const tabs = [
  "Overview",
  "Personal & family",
  "Employment",
  "Documents",
  "Assets & benefits",
  "Activity",
] as const;
type Tab = (typeof tabs)[number];
export function EmployeeProfile() {
  const [profile,setProfile]=useState<any>(null),[profileError,setProfileError]=useState(""),[tab, setTab] = useState<Tab>("Overview"),
    [editing, setEditing] = useState(false),
    [sent, setSent] = useState(false),
    [toast, setToast] = useState("");
  const drawer = useRef<HTMLElement>(null);
  const close = useCallback(() => {
    setEditing(false);
    setSent(false);
  }, []);
  useDialogFocus(editing, close, drawer);
  useEffect(()=>{httpRequest("/api/v2/me").then(setProfile).catch(e=>setProfileError(e.message))},[]);
  const e={...fixtureEmployee,...(profile?{name:profile.fullName,title:profile.designation,department:profile.department,employeeNumber:profile.employeeNumber,location:profile.location||fixtureEmployee.location,status:profile.status}:{}),initials:profile?.fullName?.split(" ").map((x:string)=>x[0]).slice(0,2).join("")||fixtureEmployee.initials};
  const notify = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(""), 2200);
  };
  return (
    <div className="passport-page">
      <nav className="profile-breadcrumb">
        <Link href="/">Home</Link>
        <span>/</span>
        <b>My Space</b>
      </nav>
      <section className="passport-hero">
        {profileError&&<p className="core-error">Live profile unavailable: {profileError}. Showing the last known employee passport.</p>}
        <div className="passport-avatar">
          {e.initials}
          <i />
        </div>
        <div className="passport-identity">
          <p className="eyebrow">
            MY EMPLOYEE PASSPORT · {tenant.displayName.toUpperCase()}
          </p>
          <h1>{e.name}</h1>
          <p>
            {e.title} · {e.department}
          </p>
          <div>
            <span>
              <Briefcase /> {e.employeeNumber}
            </span>
            <span>
              <MapPin /> {e.location}
            </span>
            <span className="active">
              <Check /> {e.status}
            </span>
          </div>
        </div>
        <div className="passport-actions">
          <Link href={`/people/${e.slug}`}>Public directory profile</Link>
          <button onClick={() => setEditing(true)}>
            <Pencil />
            Edit profile
          </button>
        </div>
        <div className="passport-progress">
          <strong>{e.completion}%</strong>
          <span>Profile complete</span>
          <i>
            <b style={{ width: `${e.completion}%` }} />
          </i>
          <small>Add a profile photo to finish</small>
        </div>
      </section>
      <nav className="passport-tabs" aria-label="Profile sections">
        {tabs.map((x) => (
          <button
            key={x}
            className={tab === x ? "active" : ""}
            aria-selected={tab === x}
            role="tab"
            onClick={() => setTab(x)}
          >
            {x}
          </button>
        ))}
      </nav>
      <div className="passport-content" role="tabpanel">
        {tab === "Overview" && <Overview />}
        {tab === "Personal & family" && <Personal />}
        {tab === "Employment" && <Employment />}
        {tab === "Documents" && <Documents notify={notify} />}{" "}
        {tab === "Assets & benefits" && <Assets />}
        {tab === "Activity" && <Activity />}
      </div>
      {editing && (
        <>
          <button
            className="flow-backdrop"
            aria-label="Close edit profile"
            onClick={close}
          />
          <aside
            className="record-drawer profile-edit-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-profile-title"
            ref={drawer}
            tabIndex={-1}
          >
            <header className="drawer-header">
              <div>
                <p className="eyebrow">PROFILE CHANGE REQUEST</p>
                <h2 id="edit-profile-title">Edit your profile</h2>
                <p>
                  Protected information is reviewed before it changes in your
                  employee record.
                </p>
              </div>
              <button
                className="drawer-close"
                onClick={close}
                aria-label="Close"
              >
                <X />
              </button>
            </header>
            <div className="drawer-body">
              {sent ? (
                <div className="profile-success">
                  <Check />
                  <h3>Request sent for review</h3>
                  <p>
                    People Operations will verify the change. You’ll receive an
                    update here and by email.
                  </p>
                </div>
              ) : (
                <form
                  id="profile-edit"
                  className="profile-edit-form"
                  onSubmit={(x) => {
                    x.preventDefault();
                    setSent(true);
                  }}
                >
                  <label>
                    Information category
                    <select required defaultValue="">
                      <option value="" disabled>
                        Select category
                      </option>
                      <option>Personal details</option>
                      <option>Contact or address</option>
                      <option>Family or nominee</option>
                      <option>Bank details</option>
                      <option>Identity document</option>
                    </select>
                  </label>
                  <label>
                    Updated information
                    <textarea
                      required
                      minLength={5}
                      placeholder="Enter the corrected value and any helpful context"
                    />
                  </label>
                  <label>
                    Effective date
                    <input type="date" required />
                  </label>
                  <label className="file-field">
                    <Upload />
                    Supporting document (optional)
                    <input type="file" />
                  </label>
                  <p className="privacy-note">
                    <LockKeyhole />
                    Only authorized People Operations reviewers can access this
                    request.
                  </p>
                </form>
              )}
            </div>
            <footer className="drawer-footer">
              <button className="secondary-button" onClick={close}>
                {sent ? "Close" : "Cancel"}
              </button>
              {!sent && (
                <button
                  className="primary-button"
                  form="profile-edit"
                  type="submit"
                >
                  Submit change
                </button>
              )}
            </footer>
          </aside>
        </>
      )}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
function Card({
  title,
  children,
  wide = false,
}: {
  title: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <section className={`passport-card ${wide ? "wide" : ""}`}>
      <h2>{title}</h2>
      {children}
    </section>
  );
}
function Facts({ items }: { items: [string, string][] }) {
  return (
    <dl className="passport-facts">
      {items.map(([a, b]) => (
        <div key={a}>
          <dt>{a}</dt>
          <dd>{b}</dd>
        </div>
      ))}
    </dl>
  );
}
function Overview() {
  return (
    <div className="passport-grid">
      <Card title="Employment essentials">
        <Facts
          items={[
            ["Employee number", e.employeeNumber],
            ["Manager", e.manager],
            ["Joining date", e.joined],
            ["Work mode", e.workMode],
            ["Legal entity", e.entity],
            ["Location", e.location],
          ]}
        />
      </Card>
      <Card title="People support">
        <div className="contact-person">
          <span>PN</span>
          <p>
            <b>{e.manager}</b>
            <small>Reporting manager</small>
          </p>
          <Link href={`/people/${e.managerSlug}`}>View</Link>
        </div>
        <div className="contact-person">
          <span>MS</span>
          <p>
            <b>{e.hrContact}</b>
            <small>HR contact</small>
          </p>
          <a href="mailto:people@northstar.example">
            <Mail />
            Email
          </a>
        </div>
      </Card>
      <Card title="Readiness & upcoming">
        <ul className="profile-checklist">
          <li>
            <Check />
            Identity and payroll details verified
          </li>
          <li>
            <Check />
            Benefits nomination complete
          </li>
          <li className="due">
            <CalendarDays />
            Tax declaration due 12 August
          </li>
          <li className="due">
            <Upload />
            Add a profile photograph
          </li>
        </ul>
      </Card>
      <Card title="Shortcuts">
        <div className="profile-shortcuts">
          <Link href="/leave/apply">Request leave</Link>
          <Link href="/payroll/payslips/2026-06">Latest payslip</Link>
          <Link href="/payroll/tax">Tax declarations</Link>
          <Link href="/attendance/regularize">Regularize attendance</Link>
        </div>
      </Card>
    </div>
  );
}
function Personal() {
  return (
    <div className="passport-grid">
      <Card title="Contact & address">
        <Facts
          items={[
            ["Work email", e.email],
            ["Mobile", e.phone],
            ["Current address", e.address],
          ]}
        />
      </Card>
      <Card title="Emergency contact">
        <Facts
          items={[
            ["Primary contact", e.emergency],
            ["Status", "Verified 18 July 2026"],
          ]}
        />
      </Card>
      <Card title="Family & nominees">
        <Facts
          items={[
            ["Family summary", e.family],
            ["Medical insurance", "3 covered members"],
            ["PF nominee", "Nomination complete"],
          ]}
        />
        <p className="privacy-note">
          <LockKeyhole />
          Visible only to you and authorized People Operations staff.
        </p>
      </Card>
    </div>
  );
}
function Employment() {
  return (
    <div className="passport-grid">
      <Card title="Role and organization">
        <Facts
          items={[
            ["Job title", e.title],
            ["Department", e.department],
            ["Team", e.team],
            ["Manager", e.manager],
            ["Legal entity", e.entity],
          ]}
        />
      </Card>
      <Card title="Employment timeline">
        <Facts
          items={[
            ["Joining date", e.joined],
            ["Employment type", "Permanent · Full-time"],
            ["Total experience", e.experience],
            ["Current role since", "1 April 2025"],
            ["Notice period", "60 days"],
          ]}
        />
      </Card>
    </div>
  );
}
function Documents({ notify }: { notify: (m: string) => void }) {
  const [selected, setSelected] = useState<PreviewableEmployeeDocument | null>(null);
  const viewer = useRef<HTMLElement>(null);
  const closeViewer = useCallback(() => setSelected(null), []);
  useDialogFocus(Boolean(selected), closeViewer, viewer);

  return (
    <>
      <Card title="My verified documents" wide>
        <div className="document-list">
          {employeeDocuments.map((d) => (
            <article key={d.id}>
              <FileText />
              <p>
                <b>{d.name}</b>
                <small>{d.detail}</small>
              </p>
              <span>{d.status}</span>
              <button
                type="button"
                onClick={() => {
                  if (d.action === "View") setSelected(d);
                  else notify("Form 16 download is unavailable in this demo workspace");
                }}
                aria-label={`${d.action} ${d.name}`}
              >
                {d.action === "Download" ? <Download /> : null}
                {d.action}
              </button>
            </article>
          ))}
        </div>
      </Card>
      {selected && (
        <>
          <button
            type="button"
            className="flow-backdrop document-viewer-backdrop"
            aria-label="Close document preview"
            onClick={closeViewer}
          />
          <section
            className="document-viewer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="document-viewer-title"
            ref={viewer}
            tabIndex={-1}
            onClick={(event) => event.stopPropagation()}
          >
            <header className="document-viewer-header">
              <div>
                <p className="eyebrow">{selected.category} · {selected.status}</p>
                <h2 id="document-viewer-title">{selected.name}</h2>
              </div>
              <button type="button" onClick={closeViewer} aria-label="Close document preview">
                <X />
              </button>
            </header>
            <div className="document-viewer-meta">
              <span><ShieldCheck /> {selected.status}</span>
              <span>{selected.detail}</span>
              <span><LockKeyhole /> Protected view</span>
            </div>
            <div className="document-viewer-stage">
              <article className="document-paper">
                <header>
                  <div className="document-paper-mark"><FileText /></div>
                  <div>
                    <p>Demo document summary</p>
                    <h3>{selected.name}</h3>
                    <small>No source scan or PDF is stored in this demo.</small>
                  </div>
                </header>
                <dl>
                  {selected.preview.fields.map(([label, value]) => (
                    <div key={label}>
                      <dt>{label}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
                </dl>
                <div className="document-verification">
                  <ShieldCheck />
                  <div>
                    <b>Record summary</b>
                    <p>{selected.preview.summary}</p>
                  </div>
                </div>
                <p className="document-privacy-note"><LockKeyhole /> {selected.preview.note}</p>
              </article>
            </div>
            <footer className="document-viewer-footer">
              <small>Demo summary · Last checked 5 August 2026</small>
              <button type="button" className="secondary-button" onClick={closeViewer}>Close</button>
            </footer>
          </section>
        </>
      )}
    </>
  );
}
function Assets() {
  return (
    <div className="passport-grid">
      <Card title="Company assets">
        <div className="asset-row">
          <Laptop />
          <p>
            <b>MacBook Pro 14-inch</b>
            <small>Asset NS-IT-2841 · Assigned 04 Jan 2024</small>
          </p>
          <span>Good condition</span>
        </div>
        <div className="asset-row">
          <ShieldCheck />
          <p>
            <b>Access and security kit</b>
            <small>YubiKey · ID card · Laptop charger</small>
          </p>
          <span>Assigned</span>
        </div>
      </Card>
      <Card title="Benefits">
        <div className="asset-row">
          <HeartPulse />
          <p>
            <b>Group health insurance</b>
            <small>Employee + 2 dependents · ₹8L cover</small>
          </p>
          <span>Active</span>
        </div>
        <Facts
          items={[
            ["Provident Fund", "UAN linked · contribution active"],
            ["Gratuity", "Eligible from 04 Jan 2029"],
            ["Leave balance", "24 days available"],
          ]}
        />
      </Card>
    </div>
  );
}
function Activity() {
  return (
    <Card title="Profile audit trail" wide>
      <ol className="activity-list">
        <li>
          <b>Address change submitted</b>
          <span>25 Jul 2026 · Awaiting People Ops review</span>
        </li>
        <li>
          <b>Form 16 published</b>
          <span>12 Jun 2026 · Payroll system</span>
        </li>
        <li>
          <b>Insurance dependents verified</b>
          <span>08 Apr 2026 · Benefits team</span>
        </li>
        <li>
          <b>Role changed to Product Lead</b>
          <span>01 Apr 2025 · Approved by Priya Nair</span>
        </li>
      </ol>
    </Card>
  );
}
