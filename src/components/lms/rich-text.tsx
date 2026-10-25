import { Fragment, type ReactNode } from "react";

/**
 * Safe "markdown-ish" renderer for lesson text. It builds React elements only — no HTML strings are
 * ever injected — so author content cannot run scripts. Supports #/##/### headings, - / 1. lists,
 * > quotes, **bold**, *italic*, `code` and [links](https://…) (http/https only).
 */
export function RichText({ source, className = "lms-prose" }: { source: string; className?: string }) {
  const lines = String(source || "").replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();
    if (!trimmed) { index += 1; continue; }
    const heading = /^(#{1,3})\s+(.*)$/.exec(trimmed);
    if (heading) {
      const level = heading[1].length;
      const content = inline(heading[2], `h${index}`);
      blocks.push(level === 1 ? <h2 key={index}>{content}</h2> : level === 2 ? <h3 key={index}>{content}</h3> : <h4 key={index}>{content}</h4>);
      index += 1; continue;
    }
    if (/^[-*]\s+/.test(trimmed)) {
      const items: ReactNode[] = [];
      while (index < lines.length && /^[-*]\s+/.test(lines[index].trim())) { items.push(<li key={index}>{inline(lines[index].trim().replace(/^[-*]\s+/, ""), `l${index}`)}</li>); index += 1; }
      blocks.push(<ul key={`ul${index}`}>{items}</ul>); continue;
    }
    if (/^\d+[.)]\s+/.test(trimmed)) {
      const items: ReactNode[] = [];
      while (index < lines.length && /^\d+[.)]\s+/.test(lines[index].trim())) { items.push(<li key={index}>{inline(lines[index].trim().replace(/^\d+[.)]\s+/, ""), `o${index}`)}</li>); index += 1; }
      blocks.push(<ol key={`ol${index}`}>{items}</ol>); continue;
    }
    if (trimmed.startsWith(">")) {
      const quote: string[] = [];
      while (index < lines.length && lines[index].trim().startsWith(">")) { quote.push(lines[index].trim().replace(/^>\s?/, "")); index += 1; }
      blocks.push(<blockquote key={`q${index}`}>{inline(quote.join(" "), `q${index}`)}</blockquote>); continue;
    }
    const paragraph: string[] = [];
    while (index < lines.length && lines[index].trim() && !/^(#{1,3}\s|[-*]\s|\d+[.)]\s|>)/.test(lines[index].trim())) { paragraph.push(lines[index].trim()); index += 1; }
    blocks.push(<p key={`p${index}`}>{inline(paragraph.join(" "), `p${index}`)}</p>);
  }
  return <div className={className}>{blocks}</div>;
}

const TOKEN = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)\s]+\)|\*[^*\s][^*]*\*|_[^_\s][^_]*_)/g;

function inline(text: string, key: string): ReactNode[] {
  return text.split(TOKEN).filter(Boolean).map((part, index) => {
    const id = `${key}-${index}`;
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) return <strong key={id}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) return <code key={id}>{part.slice(1, -1)}</code>;
    const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(part);
    if (link) {
      const href = safeHref(link[2]);
      return href ? <a key={id} href={href} target="_blank" rel="noopener noreferrer nofollow">{link[1]}</a> : <Fragment key={id}>{link[1]}</Fragment>;
    }
    if ((part.startsWith("*") && part.endsWith("*")) || (part.startsWith("_") && part.endsWith("_"))) return part.length > 2 ? <em key={id}>{part.slice(1, -1)}</em> : <Fragment key={id}>{part}</Fragment>;
    return <Fragment key={id}>{part}</Fragment>;
  });
}

function safeHref(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch { return null; }
}
