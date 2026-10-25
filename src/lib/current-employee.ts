export const currentEmployee = {
  slug: "vikas-tiwari",
  employeeNumber: "E1675",
  initials: "VT",
  name: "Vikas Tiwari",
  title: "Product Lead",
  department: "Product & Technology",
  location: "Gurugram, India",
  status: "Active",
  manager: "Priya Nair",
  managerSlug: "priya-nair",
  joined: "4 January 2024",
  completion: 92,
  email: "vikas.tiwari@northstar.example",
  phone: "+91 98••• 4812",
  address: "Mehrauli–Gurgaon Road, Gurugram, Haryana 122002",
  workMode: "Hybrid · 3 days office",
  entity: "India Operations Pvt. Ltd.",
  experience: "8 years 7 months",
  team: "Consumer Experience",
  emergency: "Anjali Tiwari · Spouse · +91 98••• 1204",
  family: "Spouse and one dependent · benefits nomination complete",
  hrContact: "Meera Shah · People Partner",
} as const;

export const employeeDocuments = [
  {
    id: "employment-agreement",
    name: "Employment agreement",
    detail: "Signed 04 Jan 2024",
    status: "Verified",
    action: "View",
    category: "Employment record",
    preview: {
      fields: [
        ["Employee", "Vikas Tiwari"],
        ["Role", "Product Lead"],
        ["Start date", "4 January 2024"],
        ["Legal entity", "India Operations Pvt. Ltd."],
      ],
      summary: "Digitally signed by both parties and verified against the employee joining record.",
      note: "This agreement summary is available to you and authorized People Operations staff.",
    },
  },
  {
    id: "pan",
    name: "PAN",
    detail: "ABCDE••••F",
    status: "Verified",
    action: "View",
    category: "Statutory identity",
    preview: {
      fields: [
        ["PAN", "ABCDE••••F"],
        ["Name on record", "Vikas Tiwari"],
        ["Verification", "Verified with payroll record"],
        ["Used for", "Income tax and payroll reporting"],
      ],
      summary: "The masked identifier matches the statutory identity held in your payroll profile.",
      note: "Only the masked identifier is shown in this protected view.",
    },
  },
  {
    id: "uan-provident-fund",
    name: "UAN / Provident Fund",
    detail: "1009 •••• 7842",
    status: "Linked",
    action: "View",
    category: "Benefits record",
    preview: {
      fields: [
        ["Universal Account Number", "1009 •••• 7842"],
        ["Linked employee", "Vikas Tiwari · E1675"],
        ["Employer", "India Operations Pvt. Ltd."],
        ["Contribution status", "Active · payroll linked"],
      ],
      summary: "The provident fund account is linked to the current employment and monthly contribution workflow.",
      note: "Contribution values are available in your payroll statements.",
    },
  },
  {
    id: "form-16-2025-26",
    name: "Form 16 · FY 2025–26",
    detail: "Issued 12 Jun 2026",
    status: "Available",
    action: "Download",
  },
  {
    id: "aadhaar-identity",
    name: "Aadhaar / Identity",
    detail: "•••• •••• 4921",
    status: "Verified",
    action: "View",
    category: "Protected identity",
    preview: {
      fields: [
        ["Identity number", "•••• •••• 4921"],
        ["Name on record", "Vikas Tiwari"],
        ["Verification", "Identity verified"],
        ["Record access", "Employee and authorized People Operations"],
      ],
      summary: "The identity record has been verified for employment and benefits administration.",
      note: "This view intentionally masks sensitive identity data. Never share an unmasked number over email or chat.",
    },
  },
] as const;

export type EmployeeDocument = (typeof employeeDocuments)[number];
export type PreviewableEmployeeDocument = Extract<EmployeeDocument, { action: "View" }>;
