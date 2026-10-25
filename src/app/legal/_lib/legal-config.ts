// Server-only: company particulars and sub-processors for the public legal pages, read from the environment at request
// time. Unset values render as visible [placeholders] so a draft can never be mistaken for a finished document.

const value = (key: string, placeholder: string) => {
  const text = (process.env[key] || "").trim();
  return { text: text || `[${placeholder}]`, missing: !text };
};

export function legalEntity() {
  return {
    name: value("LEGAL_COMPANY_NAME", "Company legal name"),
    brand: value("LEGAL_PRODUCT_NAME", "Northstar HRM"),
    address: value("LEGAL_COMPANY_ADDRESS", "Registered office address"),
    cin: value("LEGAL_CIN", "CIN"),
    gstin: value("LEGAL_GSTIN", "GSTIN"),
    email: value("LEGAL_CONTACT_EMAIL", "legal@your-domain"),
    privacyEmail: value("LEGAL_PRIVACY_EMAIL", "privacy@your-domain"),
    securityEmail: value("LEGAL_SECURITY_EMAIL", "security@your-domain"),
    grievanceOfficer: value("LEGAL_GRIEVANCE_OFFICER", "Grievance officer name"),
    jurisdiction: value("LEGAL_JURISDICTION_CITY", "City"),
    effectiveDate: value("LEGAL_EFFECTIVE_DATE", "Effective date"),
  };
}
export type LegalEntity = ReturnType<typeof legalEntity>;

export type SubProcessor = { name: string; purpose: string; data: string; location: string; active: boolean; note?: string };

function hostOf(url: string | undefined) {
  if (!url) return "";
  try { return new URL(url.includes("://") ? url : `https://${url}`).hostname; } catch { return url; }
}
const isLocal = (host: string) => !host || /^(localhost|127\.|\[::1\]|.*\.localhost$|.*\.test$)/.test(host);

/** Derived from the deployment configuration, so the list matches what is actually switched on. */
export function subProcessors(): SubProcessor[] {
  const env = process.env;
  const list: SubProcessor[] = [];
  const hosting = (env.LEGAL_HOSTING_PROVIDER || "").trim();
  list.push({
    name: hosting || "Amazon Web Services India Pvt. Ltd. (AWS)", purpose: "Cloud hosting: application servers, PostgreSQL database, Redis queue, backups",
    data: "All customer data", location: env.LEGAL_HOSTING_REGION || "India — Mumbai (ap-south-1)", active: true,
    note: hosting ? undefined : "Set LEGAL_HOSTING_PROVIDER / LEGAL_HOSTING_REGION to match the production environment.",
  });
  const storage = (env.FILES_STORAGE || "local").toLowerCase();
  const endpoint = hostOf(env.FILES_S3_ENDPOINT);
  list.push(storage === "s3"
    ? {
        name: endpoint ? `S3-compatible object storage (${endpoint})` : "Amazon Web Services — Amazon S3",
        purpose: "Encrypted file storage (ID proofs, punch selfies, receipts, payslips, exports), one folder per client company",
        data: "Uploaded documents and photos", location: endpoint ? "As configured" : `India — ${env.FILES_S3_REGION || env.AWS_REGION || "ap-south-1"}`, active: true,
      }
    : { name: "Object storage (Amazon S3)", purpose: "Encrypted file storage", data: "Uploaded documents and photos", location: "India — ap-south-1", active: false,
        note: "This deployment stores files on its own servers (development). Production must use S3." });
  const smtp = hostOf(env.SMTP_HOST);
  const mailName = /amazonaws|amazonses/.test(smtp) ? "Amazon Web Services — Amazon SES" : /sendgrid/.test(smtp) ? "Twilio SendGrid" : /postmark/.test(smtp) ? "Postmark (ActiveCampaign)"
    : /mailgun/.test(smtp) ? "Mailgun (Sinch)" : /zoho/.test(smtp) ? "Zoho Corporation" : /google|gmail/.test(smtp) ? "Google Workspace" : smtp ? `Email provider (${smtp})` : "Transactional email provider";
  list.push({ name: mailName, purpose: "Transactional email (sign-in links, approvals, notifications)", data: "Name, work email, message content",
    location: env.LEGAL_EMAIL_REGION || (/amazonaws/.test(smtp) ? `AWS ${smtp.split(".")[1] || "region"}` : "[Region]"), active: !!smtp && !isLocal(smtp),
    note: smtp ? undefined : "Not configured: emails are written to a local development mailbox." });
  list.push({ name: "Google LLC — Firebase Cloud Messaging", purpose: "Push notifications to Android devices", data: "Device token, notification title/text",
    location: "Global (Google)", active: !!(env.FCM_PROJECT_ID || env.FCM_SERVICE_ACCOUNT_JSON || env.FCM_SERVICE_ACCOUNT_PATH) });
  list.push({ name: "Apple Inc. — Apple Push Notification service", purpose: "Push notifications to iPhone/iPad", data: "Device token, notification title/text",
    location: "Global (Apple)", active: !!(env.APNS_KEY_ID && env.APNS_TEAM_ID) });
  list.push({ name: "Razorpay Software Pvt. Ltd. — RazorpayX", purpose: "Salary and reimbursement payouts (only for companies that switch payouts on)",
    data: "Employee name, bank account, IFSC, amount", location: "India", active: !!(env.RAZORPAYX_KEY_ID && env.RAZORPAYX_KEY_SECRET) });
  const ocr = (env.RECEIPT_OCR_PROVIDER || "auto").toLowerCase();
  list.push({ name: "Anthropic PBC", purpose: "Reading expense receipts (AI text extraction) — only the receipt image", data: "Receipt images",
    location: "United States", active: ocr === "anthropic" || (ocr === "auto" && !!env.ANTHROPIC_API_KEY),
    note: "Cross-border transfer: permitted under DPDP Act s.16 unless the country is restricted by notification — confirm with counsel." });
  const issuer = hostOf(env.OIDC_ISSUER);
  if (issuer && !isLocal(issuer)) list.push({ name: `Identity provider (${issuer})`, purpose: "Single sign-on", data: "Name, email, sign-in events", location: "As configured", active: true,
    note: "Usually chosen and contracted by the client company itself." });
  return list;
}
