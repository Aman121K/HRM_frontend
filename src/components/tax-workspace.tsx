"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  Check,
  ChevronRight,
  FileCheck2,
  FileText,
  Info,
  Landmark,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Upload,
} from "lucide-react";
import { httpRequest } from "@/lib/http-client";

const TAX = "/api/v2/payroll/tax";

type Inputs = Record<string, number>;
type Result = {
  regime: string;
  grossIncome: number;
  exemptions: number;
  standardDeduction: number;
  deductions: number;
  taxableIncome: number;
  bands: {
    from: number;
    to: number | null;
    rate: number;
    taxable: number;
    tax: number;
  }[];
  taxBeforeRebate: number;
  rebate: number;
  cess: number;
  annualLiability: number;
  tdsDeducted: number;
  remainingTax: number;
  projectedMonthlyTds: number;
  scopeNotice?: string;
};
type Item = {
  id: string;
  category: string;
  instrument: string;
  provider: string;
  reference: string;
  date: string;
  amount: number;
  proofStatus: string;
  remarks: string;
  details?: Record<string, string | boolean>;
};
type Declaration = {
  id: string;
  status: string;
  version: number;
  regime: "NEW" | "OLD";
  completeness: number;
  submitted_at?: string;
  updated_at: string;
  items: Item[];
  inputs: Inputs;
  calculation: Result;
};
const payroll: Inputs = {
  basic: 960000,
  hra: 480000,
  specialAllowance: 360000,
  bonus: 120000,
  taxableAllowances: 40000,
  previousEmployerSalary: 0,
  otherIncome: 18000,
  housePropertyIncome: 0,
  specialRateIncome: 0,
  professionalTax: 2400,
  hraExemption: 240000,
  lta: 30000,
  homeLoanInterest: 0,
  section80C: 150000,
  section80DSelf: 25000,
  section80DParents: 50000,
  nps80CCD1B: 50000,
  employerNps: 60000,
  educationLoanInterest: 0,
  donations: 10000,
  otherDeductions: 0,
  tdsDeducted: 55260,
};
const inr = (n = 0) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
const fields = [
  ["basic", "Basic salary"],
  ["hra", "House rent allowance"],
  ["specialAllowance", "Special allowance"],
  ["bonus", "Bonus / variable"],
  ["taxableAllowances", "Taxable perks & allowances"],
  ["previousEmployerSalary", "Previous-employer salary"],
  ["otherIncome", "Other income"],
  ["housePropertyIncome", "House-property income / loss"],
  ["tdsDeducted", "TDS already deducted"],
];
const deductionFields = [
  ["hraExemption", "HRA exemption"],
  ["lta", "LTA exemption"],
  ["professionalTax", "Professional tax"],
  ["homeLoanInterest", "Home-loan interest"],
  ["section80C", "80C investments"],
  ["section80DSelf", "80D · self & family"],
  ["section80DParents", "80D · parents"],
  ["nps80CCD1B", "NPS 80CCD(1B)"],
  ["employerNps", "Employer NPS"],
  ["educationLoanInterest", "Education-loan interest"],
  ["donations", "Eligible donations"],
];
const categories = [
  "HRA / Rent",
  "80C Investment",
  "Medical Insurance · 80D",
  "NPS",
  "Home Loan",
  "LTA",
  "Donation",
  "Education Loan",
  "Previous Employment / TDS",
  "Employer Benefit",
];

export function TaxWorkspace() {
  const [tab, setTab] = useState("Tax overview"),
    [inputs, setInputs] = useState<Inputs>(payroll),
    [regime, setRegime] = useState<"NEW" | "OLD">("NEW"),
    [comparison, setComparison] = useState<Record<string, Result>>({}),
    [declaration, setDeclaration] = useState<Declaration | null>(null),
    [items, setItems] = useState<Item[]>([]),
    [proofs, setProofs] = useState<any[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [toast, setToast] = useState(""),
    [consent, setConsent] = useState(false),
    [reviewing, setReviewing] = useState(false);
  const request = useCallback(
    // Identity comes from the signed-in session (authHeaders); the API enforces who may read or change each declaration.
    (path: string, options: { method?: string; body?: unknown } = {}) =>
      httpRequest<any>(`${TAX}${path}`, options),
    [],
  );
  const recalculate = useCallback(
    async (value = inputs) => {
      try {
        setError("");
        const [newR, oldR] = await Promise.all([
          request("/calculate", {
            method: "POST",
            body: { regime: "NEW", inputs: value },
          }),
          request("/calculate", {
            method: "POST",
            body: { regime: "OLD", inputs: value },
          }),
        ]);
        setComparison({ NEW: newR.result, OLD: oldR.result });
      } catch (e) {
        setError(
          e instanceof Error ? e.message : "Tax service is unavailable.",
        );
      }
    },
    [inputs, request],
  );
  useEffect(() => {
    const timer = setTimeout(() => recalculate(inputs), 350);
    return () => clearTimeout(timer);
  }, [inputs, recalculate]);
  useEffect(() => {
    request("/declarations")
      .then((d) => {
        const current = d.items?.[0];
        if (current) {
          setDeclaration(current);
          setItems(current.items || []);
          setRegime(current.regime);
          setInputs({ ...payroll, ...current.inputs });
        }
      })
      .catch(() => {});
  }, [request]);
  const result = comparison[regime],
    best =
      comparison.NEW && comparison.OLD
        ? comparison.NEW.annualLiability <= comparison.OLD.annualLiability
          ? "NEW"
          : "OLD"
        : null,
    difference =
      comparison.NEW && comparison.OLD
        ? Math.abs(
            comparison.NEW.annualLiability - comparison.OLD.annualLiability,
          )
        : 0;
  const notify = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(""), 2400);
  };
  const save = async () => {
    setBusy(true);
    setError("");
    try {
      const body = { regime, inputs, items, consent };
      // Accepted, rejected or withdrawn declarations are closed; saving again starts a new version.
      const editable = declaration && ["DRAFT", "CLARIFICATION"].includes(declaration.status);
      const d = editable && declaration
        ? await request(`/declarations/${declaration.id}`, {
            method: "PATCH",
            body: { ...body, version: declaration.version },
          })
        : await request("/declarations", { method: "POST", body });
      setDeclaration(d);
      setItems(d.items);
      if (d.validationErrors?.length) {
        setError(d.validationErrors.map((x: any) => x.message).join(" · "));
        return null;
      }
      notify("Draft saved securely");
      return d;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save draft.");
      return null;
    } finally {
      setBusy(false);
    }
  };
  const submit = async () => {
    if (!reviewing) {
      const saved = await save();
      if (saved) setReviewing(true);
      return;
    }
    if (!declaration) {
      setError("Save your declaration before submitting.");
      return;
    }
    if (!consent) {
      setError("Confirm the employee declaration before submission.");
      return;
    }
    setBusy(true);
    try {
      const d = await request(
        `/declarations/${declaration.id}/submit`,
        {
          method: "POST",
          body: { consent, version: declaration.version },
        },
      );
      setDeclaration(d);
      setReviewing(false);
      notify("Declaration submitted to Payroll");
      setTab("Submission history");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Submission failed.");
    } finally {
      setBusy(false);
    }
  };
  const addItem = (value: unknown = "80C Investment") => {
    const active =
        typeof document !== "undefined"
          ? document.activeElement?.textContent || ""
          : "",
      category =
        typeof value === "string"
          ? value
          : categories.find((c) => active.startsWith(c)) || "80C Investment";
    setItems((x) => [
      ...x,
      {
        id: crypto.randomUUID(),
        category,
        instrument: "",
        provider: "",
        reference: "",
        date: "",
        amount: 0,
        proofStatus: "MISSING",
        remarks: "",
        details: {},
      },
    ]);
  };
  const updateItem = (id: string, key: string, value: string | number) =>
    setItems((xs) => xs.map((x) => (x.id === id ? { ...x, [key]: value } : x)));
  const upload = async (file: File, item?: Item) => {
    if (!declaration) {
      setError("Save the declaration before uploading proofs.");
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      setBusy(true);
      try {
        const d = await request(
          `/declarations/${declaration.id}/proofs`,
          {
            method: "POST",
            body: {
              category: item?.category || "OTHER",
              itemId: item?.id,
              originalName: file.name,
              mimeType: file.type,
              base64: reader.result,
            },
          },
        );
        setProofs(d.items);
        if (item) updateItem(item.id, "proofStatus", "UPLOADED");
        notify("Proof persisted and linked");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Upload failed.");
      } finally {
        setBusy(false);
      }
    };
    reader.readAsDataURL(file);
  };
  useEffect(() => {
    if (declaration && tab === "Proofs")
      request(`/declarations/${declaration.id}/proofs`)
        .then((d) => setProofs(d.items))
        .catch(() => {});
  }, [declaration, request, tab]);
  return (
    <main className="tax-page">
      <header className="tax-title">
        <div>
          <p className="eyebrow">PAYROLL · FY 2026–27</p>
          <h1>Your tax, explained</h1>
          <p>
            Compare regimes, declare eligible investments and see how each rupee
            changes projected TDS.
          </p>
        </div>
        <div className="tax-deadline">
          <span>DECLARATION WINDOW</span>
          <b>Closes 31 January 2027</b>
          <small>
            {declaration?.status || "Not started"} · Payroll review in 3 working
            days
          </small>
        </div>
      </header>
      <nav className="tax-tabs" aria-label="Tax workspace sections">
        {[
          "Tax overview",
          "Calculator",
          "Declarations",
          "Proofs",
          "Submission history",
        ].map((x) => (
          <button
            className={tab === x ? "active" : ""}
            key={x}
            onClick={() => setTab(x)}
          >
            {x}
            {x === "Declarations" && <i>{items.length}</i>}
          </button>
        ))}
      </nav>
      {error && (
        <div className="tax-error" role="alert">
          <AlertCircle />
          <span>
            <b>Action needed</b>
            {error}
          </span>
          <button onClick={() => setError("")}>Dismiss</button>
        </div>
      )}
      {tab === "Tax overview" && (
        <>
          <section className="tax-hero">
            <div>
              <p className="eyebrow">PROJECTED ANNUAL TAX · {regime} REGIME</p>
              <strong>{result ? inr(result.annualLiability) : "—"}</strong>
              <p>
                {result
                  ? `${inr(result.remainingTax)} remaining after TDS · ${inr(result.projectedMonthlyTds)} projected per month`
                  : "Calculating from your payroll…"}
              </p>
              <button onClick={() => setTab("Calculator")}>
                Explore the calculation <ArrowRight />
              </button>
            </div>
            <aside>
              <span>
                <ShieldCheck />
              </span>
              <div>
                <small>CURRENT DECLARATION</small>
                <b>
                  {declaration
                    ? `${declaration.id.slice(0, 8).toUpperCase()} · ${declaration.status}`
                    : "Start your FY 2026–27 declaration"}
                </b>
                <p>
                  {declaration
                    ? `${declaration.completeness}% complete · ${items.filter((x) => x.proofStatus === "MISSING").length} proofs missing`
                    : "Declare investments and save a payroll-ready draft."}
                </p>
              </div>
              <button onClick={() => setTab("Declarations")}>
                {declaration ? "Continue" : "Start"} <ChevronRight />
              </button>
            </aside>
          </section>
          <Comparison
            comparison={comparison}
            selected={regime}
            setSelected={setRegime}
            best={best}
            difference={difference}
          />
          <TaxBridge result={result} />
          <section className="tax-scope">
            <Info />
            <div>
              <b>Estimate, not a filing engine</b>
              <p>
                Built for payroll planning using versioned FY 2026–27 rules.
                Special-rate income, marginal relief, surcharge, residency and
                business income may require a tax professional.
              </p>
            </div>
            <a
              href="https://www.incometax.gov.in/iec/foportal/help/individual/return-applicable-1"
              target="_blank"
              rel="noreferrer"
            >
              Official guidance ↗
            </a>
          </section>
        </>
      )}
      {tab === "Calculator" && (
        <section className="calculator-layout">
          <div className="tax-form-paper">
            <div className="paper-head">
              <div>
                <p className="eyebrow">ANNUAL SALARY INPUTS</p>
                <h2>Income loaded from payroll</h2>
              </div>
              <button onClick={() => setInputs(payroll)}>
                <RefreshCw /> Reset
              </button>
            </div>
            <div className="field-grid">
              {fields.map(([key, label]) => (
                <MoneyField
                  key={key}
                  label={label}
                  value={inputs[key]}
                  onChange={(v) => setInputs((x) => ({ ...x, [key]: v }))}
                />
              ))}
            </div>
            <div className="deduction-head">
              <div>
                <h3>Declarations & deductions</h3>
                <p>
                  {regime === "NEW"
                    ? "Only employer NPS is included in this estimate under the new regime."
                    : "Eligible old-regime values are capped by the policy ruleset."}
                </p>
              </div>
              <span className={regime === "NEW" ? "excluded" : ""}>
                {regime === "NEW" ? "EXCLUDED" : "ELIGIBLE"}
              </span>
            </div>
            <div className="field-grid">
              {deductionFields.map(([key, label]) => (
                <MoneyField
                  key={key}
                  label={label}
                  value={inputs[key]}
                  disabled={regime === "NEW" && key !== "employerNps"}
                  onChange={(v) => setInputs((x) => ({ ...x, [key]: v }))}
                />
              ))}
            </div>
          </div>
          <aside className="calc-sticky">
            <Comparison
              comparison={comparison}
              selected={regime}
              setSelected={setRegime}
              best={best}
              difference={difference}
            />
            {result && (
              <>
                <h3>Slab-by-slab tax</h3>
                <div className="slab-list">
                  {result.bands.map((b, i) => (
                    <div key={i}>
                      <span>
                        {inr(b.from)} – {b.to ? inr(b.to) : "above"}{" "}
                        <small>{b.rate * 100}%</small>
                      </span>
                      <b>{inr(b.tax)}</b>
                    </div>
                  ))}
                </div>
                <button
                  className="print-estimate"
                  onClick={() => window.print()}
                >
                  <FileText /> Print estimate
                </button>
              </>
            )}
          </aside>
        </section>
      )}
      {tab === "Declarations" && (
        <section className="declaration-wrap">
          <div className="declaration-intro">
            <div>
              <p className="eyebrow">DECLARATION DRAFT</p>
              <h2>Investment and income declarations</h2>
              <p>
                Add repeatable items. Payroll will validate eligibility and
                accepted amounts against proofs.
              </p>
            </div>
            <div className="completion">
              <span
                style={
                  {
                    "--progress": `${declaration?.completeness || Math.min(90, 25 + items.length * 12)}%`,
                  } as React.CSSProperties
                }
              >
                <b>
                  {declaration?.completeness ||
                    Math.min(90, 25 + items.length * 12)}
                  %
                </b>
              </span>
              <small>Complete</small>
            </div>
          </div>
          <div className="category-strip">
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => {
                  addItem();
                  setTimeout(() => {}, 0);
                }}
              >
                <b>{c}</b>
                <span>
                  {inr(
                    items
                      .filter((i) => i.category === c)
                      .reduce((s, i) => s + i.amount, 0),
                  )}{" "}
                  declared
                </span>
              </button>
            ))}
          </div>
          <div className="items-table">
            <div className="items-head">
              <h3>Declaration line items</h3>
              <button onClick={addItem}>
                <Plus /> Add item
              </button>
            </div>
            {!items.length ? (
              <div className="tax-empty">
                <Landmark />
                <h3>No declarations added yet</h3>
                <p>
                  Add rent, investments, insurance, NPS or other eligible items.
                  You can save and return anytime.
                </p>
                <button onClick={addItem}>Add first declaration</button>
              </div>
            ) : (
              items.map((item, index) => (
                <article className="declaration-item" key={item.id}>
                  <header>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <select
                      value={item.category}
                      onChange={(e) =>
                        updateItem(item.id, "category", e.target.value)
                      }
                    >
                      {categories.map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                    <em
                      className={
                        item.proofStatus === "MISSING" ? "missing" : "done"
                      }
                    >
                      {item.proofStatus === "MISSING"
                        ? "Proof needed"
                        : "Proof uploaded"}
                    </em>
                    <button
                      aria-label="Remove declaration"
                      onClick={() =>
                        setItems((xs) => xs.filter((x) => x.id !== item.id))
                      }
                    >
                      <Trash2 />
                    </button>
                  </header>
                  <div className="item-fields">
                    <label>
                      Instrument / type
                      <input
                        value={item.instrument}
                        onChange={(e) =>
                          updateItem(item.id, "instrument", e.target.value)
                        }
                        placeholder="e.g. ELSS mutual fund"
                      />
                    </label>
                    <label>
                      Provider / payee
                      <input
                        value={item.provider}
                        onChange={(e) =>
                          updateItem(item.id, "provider", e.target.value)
                        }
                        placeholder="Provider name"
                      />
                    </label>
                    <label>
                      Policy / reference
                      <input
                        value={item.reference}
                        onChange={(e) =>
                          updateItem(item.id, "reference", e.target.value)
                        }
                        placeholder="Stored securely; masked in review"
                      />
                    </label>
                    <label>
                      Transaction date
                      <input
                        type="date"
                        value={item.date}
                        onChange={(e) =>
                          updateItem(item.id, "date", e.target.value)
                        }
                      />
                    </label>
                    <label>
                      Declared amount
                      <input
                        type="number"
                        min="0"
                        value={item.amount || ""}
                        onChange={(e) =>
                          updateItem(item.id, "amount", Number(e.target.value))
                        }
                      />
                    </label>
                    <label className="upload-label">
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png,.webp"
                        onChange={(e) =>
                          e.target.files?.[0] && upload(e.target.files[0], item)
                        }
                      />
                      <Upload /> {busy ? "Persisting…" : "Attach proof"}
                    </label>
                  </div>
                  {item.category === "HRA / Rent" && (
                    <p className="conditional-note">
                      <Info /> Landlord name, address and PAN are required when
                      annual rent crosses the applicable policy threshold.
                    </p>
                  )}
                </article>
              ))
            )}
          </div>
          <div className="declaration-actions">
            <label>
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
              />
              <span>
                <b>Employee declaration</b>I confirm that the information and
                proofs are true, complete and may be verified by Payroll.
              </span>
            </label>
            <div>
              <button
                className="draft"
                disabled={busy || declaration?.status === "SUBMITTED"}
                onClick={save}
              >
                {busy ? "Saving…" : "Save draft"}
              </button>
              <button
                className="submit"
                disabled={busy || declaration?.status === "SUBMITTED"}
                onClick={submit}
              >
                Review & submit <ArrowRight />
              </button>
            </div>
          </div>
        </section>
      )}
      {tab === "Proofs" && (
        <section className="proof-workspace">
          <header>
            <div>
              <p className="eyebrow">EVIDENCE LIBRARY</p>
              <h2>Supporting proofs</h2>
              <p>
                PDF, JPEG, PNG or WebP · maximum 8 MB · signature-checked before
                storage.
              </p>
            </div>
            <label className="proof-upload">
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                onChange={(e) =>
                  e.target.files?.[0] && upload(e.target.files[0])
                }
              />
              <Upload /> Upload proof
            </label>
          </header>
          {!proofs.length ? (
            <div className="tax-empty">
              <FileCheck2 />
              <h3>No persisted proofs</h3>
              <p>
                Save a declaration first, then upload supporting documents here
                or against a line item.
              </p>
            </div>
          ) : (
            <div className="proof-list">
              {proofs.map((p) => (
                <article key={p.id}>
                  <FileText />
                  <span>
                    <b>{p.originalName}</b>
                    <small>
                      {p.category} · {(p.byteSize / 1024).toFixed(1)} KB ·{" "}
                      {p.status}
                    </small>
                  </span>
                  <em>Persisted</em>
                  <button
                    aria-label="Delete proof"
                    onClick={async () => {
                      try {
                        await request(
                          `/declarations/${declaration!.id}/proofs/${p.id}`,
                          { method: "DELETE" },
                        );
                        setProofs((x) => x.filter((y) => y.id !== p.id));
                      } catch (e) {
                        setError(e instanceof Error ? e.message : "Could not delete proof.");
                      }
                    }}
                  >
                    <Trash2 />
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>
      )}
      {tab === "Submission history" && (
        <section className="history-page">
          <div className="timeline-title">
            <p className="eyebrow">AUDITABLE WORKFLOW</p>
            <h2>Submission history</h2>
          </div>
          {declaration ? (
            <>
              <div className="pending-detail">
                <span>
                  <b>{declaration.status}</b>
                  <small>Current status</small>
                </span>
                <span>
                  <b>{declaration.id.slice(0, 8).toUpperCase()}</b>
                  <small>Declaration ID</small>
                </span>
                <span>
                  <b>{regime} regime</b>
                  <small>Selected regime</small>
                </span>
                <span>
                  <b>{inr(items.reduce((s, i) => s + i.amount, 0))}</b>
                  <small>Total declared</small>
                </span>
                <span>
                  <b>
                    {items.filter((i) => i.proofStatus === "MISSING").length}
                  </b>
                  <small>Missing proofs</small>
                </span>
                <span>
                  <b>Payroll team</b>
                  <small>Current reviewer · 3-day SLA</small>
                </span>
              </div>
              <div className="tax-timeline">
                {[
                  "Draft saved",
                  "Submitted to Payroll",
                  "Payroll review",
                  "Accepted for payroll",
                ].map((x, i) => (
                  <div
                    className={
                      (declaration.status === "SUBMITTED" && i < 2) || i === 0
                        ? "complete"
                        : ""
                    }
                    key={x}
                  >
                    <span>
                      {i === 0 ||
                      (declaration.status === "SUBMITTED" && i === 1) ? (
                        <Check />
                      ) : (
                        i + 1
                      )}
                    </span>
                    <div>
                      <b>{x}</b>
                      <p>
                        {i === 0
                          ? `Version ${declaration.version} · ${new Date(declaration.updated_at).toLocaleString()}`
                          : i === 1 && declaration.submitted_at
                            ? new Date(
                                declaration.submitted_at,
                              ).toLocaleString()
                            : i === 2
                              ? "Payroll checks proofs and policy eligibility"
                              : "Accepted amounts flow to projected TDS"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="tax-empty">
              <FileText />
              <h3>No declaration history yet</h3>
              <p>
                Create and save a declaration to start a versioned audit trail.
              </p>
              <button onClick={() => setTab("Declarations")}>
                Start declaration
              </button>
            </div>
          )}
        </section>
      )}
      {reviewing && (
        <>
          <button
            className="flow-backdrop"
            aria-label="Close review"
            onClick={() => setReviewing(false)}
          />
          <section
            className="record-drawer drawer-standard drawer-content tax-review"
            role="dialog"
            aria-modal="true"
            aria-labelledby="tax-review-title"
          >
            <p className="eyebrow">
              FINAL REVIEW · VERSION {declaration?.version}
            </p>
            <h2 id="tax-review-title">Confirm your declaration</h2>
            <p>
              Review the masked details below. Submission creates an immutable
              payroll snapshot.
            </p>
            <dl>
              <div>
                <dt>Tax year</dt>
                <dd>FY 2026–27</dd>
              </div>
              <div>
                <dt>Regime</dt>
                <dd>{regime}</dd>
              </div>
              <div>
                <dt>Total declared</dt>
                <dd>{inr(items.reduce((s, i) => s + i.amount, 0))}</dd>
              </div>
              <div>
                <dt>Proofs</dt>
                <dd>
                  {items.filter((i) => i.proofStatus !== "MISSING").length}{" "}
                  linked
                </dd>
              </div>
            </dl>
            <div className="review-lines">
              {items.map((x) => (
                <article key={x.id}>
                  <b>
                    {x.category} · {inr(x.amount)}
                  </b>
                  <span>
                    {x.provider} ·{" "}
                    {x.reference
                      ? `••••${x.reference.slice(-4)}`
                      : "No reference"}
                  </span>
                </article>
              ))}
            </div>
            <label className="review-consent">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
              />{" "}
              I confirm these details are true and authorize payroll
              verification.
            </label>
            <div className="flow-actions">
              <button
                className="secondary-button"
                onClick={() => setReviewing(false)}
              >
                Back to edit
              </button>
              <button
                className="primary-button"
                disabled={!consent || busy}
                onClick={submit}
              >
                {busy ? "Submitting…" : "Confirm & submit"}
              </button>
            </div>
          </section>
        </>
      )}
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </main>
  );
}

function MoneyField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  disabled?: boolean;
}) {
  return (
    <label className={disabled ? "disabled" : ""}>
      <span>
        {label}
        {disabled && <small>Not available in new regime</small>}
      </span>
      <div>
        <i>₹</i>
        <input
          disabled={disabled}
          type="number"
          min="0"
          value={value || ""}
          onChange={(e) => onChange(Number(e.target.value))}
        />
      </div>
    </label>
  );
}
function Comparison({
  comparison,
  selected,
  setSelected,
  best,
  difference,
}: {
  comparison: Record<string, Result>;
  selected: string;
  setSelected: (x: "NEW" | "OLD") => void;
  best: string | null;
  difference: number;
}) {
  return (
    <section className="regime-compare">
      <header>
        <div>
          <p className="eyebrow">REGIME COMPARISON</p>
          <h2>One salary. Two estimates.</h2>
        </div>
        {best && (
          <span>
            Potential difference <b>{inr(difference)}</b>
          </span>
        )}
      </header>
      <div>
        {(["NEW", "OLD"] as const).map((r) => (
          <button
            className={`${selected === r ? "selected" : ""} ${best === r ? "best" : ""}`}
            onClick={() => setSelected(r)}
            key={r}
          >
            <small>{r === "NEW" ? "DEFAULT REGIME" : "DECLARATION-LED"}</small>
            <b>
              {r === "NEW" ? "New regime" : "Old regime"}
              {best === r && <i>Lower estimate</i>}
            </b>
            <strong>
              {comparison[r] ? inr(comparison[r].annualLiability) : "—"}
            </strong>
            <span>
              Annual liability ·{" "}
              {comparison[r]
                ? `${inr(comparison[r].projectedMonthlyTds)}/month`
                : "Calculating"}
            </span>
          </button>
        ))}
      </div>
      <p>
        <Info /> “Lower estimate” is arithmetic for these inputs, not universal
        advice. Your filing position may differ.
      </p>
    </section>
  );
}
function TaxBridge({ result }: { result?: Result }) {
  if (!result)
    return (
      <section className="tax-bridge loading">
        Building your tax bridge…
      </section>
    );
  const steps = [
    ["Gross income", result.grossIncome, "base"],
    ["Exemptions", result.exemptions, "minus"],
    ["Standard deduction", result.standardDeduction, "minus"],
    ["Eligible deductions", result.deductions, "minus"],
    ["Taxable income", result.taxableIncome, "subtotal"],
    ["Slab tax", result.taxBeforeRebate, "base"],
    ["Rebate", result.rebate, "minus"],
    ["Surcharge", 0, "base"],
    ["Health & education cess", result.cess, "base"],
    ["Annual liability", result.annualLiability, "final"],
    ["TDS deducted", result.tdsDeducted, "minus"],
    ["Remaining tax", result.remainingTax, "final"],
  ];
  return (
    <section className="tax-bridge">
      <header>
        <p className="eyebrow">THE TAX BRIDGE</p>
        <h2>From annual earnings to payroll tax</h2>
        <span>
          Accepted proofs can change eligible deductions and projected TDS.
        </span>
      </header>
      <div>
        {steps.map(([label, value, tone], i) => (
          <article className={String(tone)} key={String(label)}>
            <small>
              {i === 0
                ? "START"
                : i === steps.length - 1
                  ? "RESULT"
                  : tone === "minus"
                    ? "LESS"
                    : "STEP"}
            </small>
            <b>{label}</b>
            <strong>{inr(Number(value))}</strong>
            {i < steps.length - 1 && <ChevronRight />}
          </article>
        ))}
      </div>
      {result.scopeNotice && (
        <p className="bridge-warning">
          <AlertCircle /> {result.scopeNotice}
        </p>
      )}
    </section>
  );
}
