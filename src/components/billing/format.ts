/** Money arrives from the billing API in paise. */
export const inr = (paise: number | null | undefined) =>
  `₹${((Number(paise) || 0) / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const rupees = (paise: number | null | undefined) => (Number(paise) || 0) / 100;
export const day = (iso?: string | null) => {
  if (!iso) return "—";
  const date = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
};
export const monthLabel = (period: string) =>
  new Date(`${period.slice(0, 7)}-01T00:00:00Z`).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });

export const PAYMENT_TONE: Record<string, string> = { UNPAID: "tone-warning", PARTIALLY_PAID: "tone-info", PAID: "tone-success", CREDITED: "tone-neutral" };
export const PAYMENT_LABEL: Record<string, string> = { UNPAID: "Unpaid", PARTIALLY_PAID: "Part paid", PAID: "Paid", CREDITED: "Credited" };

export type InvoiceRow = {
  id: string; accountId: string; accountName: string; periodStart: string; periodEnd: string; status: "DRAFT" | "ISSUED"; number: string | null;
  issueDate: string | null; dueDate: string | null; supplyType: "INTRA" | "INTER"; placeOfSupply: string; subtotalPaise: number; cgstPaise: number; sgstPaise: number;
  igstPaise: number; totalPaise: number; paidPaise: number; creditedPaise: number; outstandingPaise: number; paymentState: string; overdue: boolean; daysOverdue: number;
  isDemo: boolean; warnings?: string[]; gstRate: number; sacCode: string;
};
