import type { Metadata } from "next";
import { headers } from "next/headers";
import { Manrope } from "next/font/google";
import "./globals.css";
import "./interactions.css";
import "./tax.css";
import "./cases.css";
import "./payroll-engine.css";
import "./engagement.css";
import "./roster.css";
import "./lms.css";
import "./onboarding-flow.css";
import "./analytics.css";
import "./auth.css";
import "./risk.css";
import "./compliance.css";
import "./punch-security.css";
import "./integrations.css";
import "./jobs.css";
import "./access.css";

const manrope = Manrope({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-manrope"
});

export const metadata: Metadata = {
  title: "Northstar People — Employee Workspace",
  description: "A modern human resources operations workspace"
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // Reading the request makes every page render per request, so Next.js stamps its scripts with the CSP nonce from src/proxy.ts.
  await headers();
  return (
    <html lang="en" className={manrope.variable}>
      <body>{children}</body>
    </html>
  );
}
