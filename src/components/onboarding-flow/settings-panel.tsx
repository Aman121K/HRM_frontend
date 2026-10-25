"use client";
import { AlertTriangle, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { errorText, onboardingApi, type Settings } from "./api";
import { PersonSelect } from "./shared";

export function SettingsPanel({ flash }: { flash: (message: string) => void }) {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const hydrate = (data: Settings) => {
    setSettings(data);
    setValues({ hrOwnerId: data.hrOwner?.id || "", itOwnerId: data.itOwner?.id || "", financeOwnerId: data.financeOwner?.id || "",
      employeeNumberPrefix: data.employeeNumberPrefix, workEmailDomain: data.workEmailDomain || "", welcomeMessage: data.welcomeMessage });
  };
  useEffect(() => { onboardingApi.settings().then(hydrate).catch((reason) => setError(errorText(reason, "Unable to load settings."))); }, []);
  const set = (key: string) => (value: string) => setValues((current) => ({ ...current, [key]: value }));
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!settings) return;
    setBusy(true); setError("");
    try { hydrate(await onboardingApi.saveSettings({ version: settings.version, ...values, employeeNumberPrefix: values.employeeNumberPrefix.toUpperCase() })); flash("Onboarding settings saved"); }
    catch (reason) { setError(errorText(reason, "Unable to save settings.")); }
    finally { setBusy(false); }
  };
  if (!settings) return error ? <p className="cw-alert" role="alert"><AlertTriangle size={15} /> {error}</p> : <div className="cw-list-skeleton"><i /><i /></div>;
  return (
    <form className="ob-settings" onSubmit={submit}>
      {error && <p className="cw-alert" role="alert"><AlertTriangle size={15} /> {error}</p>}
      {!settings.saved && <p className="cw-alert warn">Using sensible defaults — save once to pin the owners below.</p>}
      <section>
        <p className="cw-section-label">Default task owners</p>
        <p className="cw-help">Manager, buddy and joiner tasks go to those people. HR, IT and Finance tasks go to the owners below (HR is the fallback for anything unassigned). Changing an owner hands over their open tasks.</p>
        <div className="cw-fields">
          <label><span>HR owner</span><PersonSelect value={values.hrOwnerId} onChange={set("hrOwnerId")} placeholder="Whoever adds the joiner" /></label>
          <label><span>IT owner</span><PersonSelect value={values.itOwnerId} onChange={set("itOwnerId")} placeholder="Falls back to HR owner" /></label>
          <label><span>Finance owner</span><PersonSelect value={values.financeOwnerId} onChange={set("financeOwnerId")} placeholder="Falls back to HR owner" /></label>
        </div>
      </section>
      <section>
        <p className="cw-section-label">Day-one conversion</p>
        <div className="cw-fields">
          <label><span>Employee number prefix</span><input value={values.employeeNumberPrefix} maxLength={6} pattern="[A-Za-z]{1,6}" onChange={(event) => set("employeeNumberPrefix")(event.target.value.toUpperCase())} /></label>
          <label><span>Work email domain</span><input value={values.workEmailDomain} maxLength={120} placeholder="company.com" onChange={(event) => set("workEmailDomain")(event.target.value)} /></label>
          <label className="wide"><span>Welcome message <small>(sent to the joiner on day one)</small></span><textarea rows={3} maxLength={2000} value={values.welcomeMessage} onChange={(event) => set("welcomeMessage")(event.target.value)} required /></label>
        </div>
      </section>
      <footer className="cw-create-foot"><button className="cw-btn primary" disabled={busy}><Save size={15} /> {busy ? "Saving…" : "Save settings"}</button></footer>
    </form>
  );
}
