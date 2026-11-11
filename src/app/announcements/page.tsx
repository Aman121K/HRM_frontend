import Link from "next/link";
import { AppShell } from "@/components/app-shell";
export default function Page() {
  return (
    <AppShell>
      <div className="core-page">
        <header className="core-heading">
          <div>
            <p className="eyebrow">COMPANY</p>
            <h1>Announcements & events</h1>
            <p>No announcements yet. Company news and events posted by HR will appear here.</p>
          </div>
        </header>
        <p><Link className="core-primary" href="/">Back to home</Link></p>
      </div>
    </AppShell>
  );
}
