import type { ReactNode } from "react";

/** A filled-in value, or a highlighted [placeholder] when the deployment hasn't set it. */
export function V({ v }: { v: { text: string; missing: boolean } }) {
  return v.missing ? <span className="lg-ph">{v.text}</span> : <>{v.text}</>;
}

/** A visible drafting note for the reviewing lawyer. */
export function Todo({ children }: { children: ReactNode }) {
  return <span className="lg-todo">Counsel to confirm: {children}</span>;
}

export function Doc({ eyebrow, title, meta, children }: { eyebrow: string; title: string; meta: ReactNode; children: ReactNode }) {
  return (
    <article className="lg-doc">
      <p className="lg-eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      <p className="lg-meta">{meta}</p>
      {children}
    </article>
  );
}
