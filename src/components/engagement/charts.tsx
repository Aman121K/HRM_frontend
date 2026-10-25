"use client";
/* Hand-made SVG charts for engagement results. No chart libraries.
 * Colour jobs: Likert and eNPS are diverging (coral = unfavourable, warm grey = neutral, teal = favourable);
 * choice bars are single-hue magnitude. Every mark carries a <title> tooltip and values are also printed as text. */
import { useState } from "react";

export const LIKERT = ["#b8483a", "#e59a8a", "#d8d3c8", "#6fb3a8", "#0b615c"];
export const ENPS_COLORS = { detractor: "#b8483a", passive: "#d8d3c8", promoter: "#0b615c" };

/** Semicircle gauge for eNPS (−100…100). */
export function EnpsGauge({ score, promoters, passives, detractors, size = 220 }: { score: number | null; promoters: number; passives: number; detractors: number; size?: number }) {
  const total = promoters + passives + detractors;
  const w = size, h = size * 0.62, cx = w / 2, cy = h - 8, r = w / 2 - 14;
  const arc = (from: number, to: number) => {
    const a0 = Math.PI * (1 - from), a1 = Math.PI * (1 - to);
    const x0 = cx + r * Math.cos(a0), y0 = cy - r * Math.sin(a0), x1 = cx + r * Math.cos(a1), y1 = cy - r * Math.sin(a1);
    return `M${x0},${y0} A${r},${r} 0 ${to - from > 0.5 ? 1 : 0} 1 ${x1},${y1}`;
  };
  const parts = total ? [
    { key: "Detractors (0–6)", n: detractors, color: ENPS_COLORS.detractor },
    { key: "Passives (7–8)", n: passives, color: ENPS_COLORS.passive },
    { key: "Promoters (9–10)", n: promoters, color: ENPS_COLORS.promoter },
  ] : [];
  let cursor = 0;
  const needle = score === null ? null : (score + 100) / 200;
  const label = score === null ? "No eNPS yet" : `eNPS ${score > 0 ? "+" : ""}${score}: ${promoters} promoters, ${passives} passives, ${detractors} detractors`;
  return (
    <figure className="eg-gauge" aria-label={label} role="img" style={{ width: w }}>
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" aria-hidden="true">
        <path d={arc(0, 1)} stroke="#ece8de" strokeWidth={18} fill="none" />
        {parts.map((part) => {
          const from = cursor, to = cursor + part.n / total;
          cursor = to;
          if (!part.n) return null;
          const gap = 0.006;
          return <path key={part.key} d={arc(from + (from ? gap : 0), to - (to < 1 ? gap : 0))} stroke={part.color} strokeWidth={18} fill="none"><title>{`${part.key}: ${part.n} (${Math.round((part.n / total) * 100)}%)`}</title></path>;
        })}
        {needle !== null && (() => {
          const a = Math.PI * (1 - needle);
          return <g><line x1={cx} y1={cy} x2={cx + (r - 26) * Math.cos(a)} y2={cy - (r - 26) * Math.sin(a)} stroke="var(--ink)" strokeWidth={2} strokeLinecap="round" /><circle cx={cx} cy={cy} r={5} fill="var(--ink)" /></g>;
        })()}
        <text x={14} y={h} className="eg-axis" textAnchor="start">−100</text>
        <text x={w - 14} y={h} className="eg-axis" textAnchor="end">+100</text>
      </svg>
      <figcaption><b>{score === null ? "—" : `${score > 0 ? "+" : ""}${score}`}</b><span>eNPS</span></figcaption>
    </figure>
  );
}

/** 100% stacked bar for a Likert distribution, with a legend and in-bar percentages. */
export function LikertBar({ distribution, labels, compact = false }: { distribution: { value: number; count: number; pct: number }[]; labels: string[]; compact?: boolean }) {
  const total = distribution.reduce((sum, item) => sum + item.count, 0);
  const summary = distribution.map((item, index) => `${labels[index] || item.value}: ${item.count}`).join(", ");
  return (
    <div className={`eg-likert${compact ? " compact" : ""}`}>
      <div className="eg-likert-bar" role="img" aria-label={`Distribution — ${summary}`}>
        {distribution.map((item, index) => item.count ? (
          <span key={item.value} style={{ flexGrow: item.count, background: LIKERT[index], color: index === 2 || index === 1 ? "var(--ink)" : "white" }} title={`${labels[index] || item.value}: ${item.count} (${item.pct}%)`}>
            {item.pct >= 9 ? `${item.pct}%` : ""}
          </span>
        ) : null)}
        {!total && <span className="empty">No answers</span>}
      </div>
      {!compact && (
        <ul className="eg-legend" aria-hidden="true">
          {labels.map((label, index) => <li key={label}><i style={{ background: LIKERT[index] }} />{index + 1} · {label} <b>{distribution[index]?.count ?? 0}</b></li>)}
        </ul>
      )}
    </div>
  );
}

/** Columns for the 0–10 eNPS distribution, coloured by band. */
export function EnpsColumns({ distribution }: { distribution: { value: number; count: number }[] }) {
  const max = Math.max(1, ...distribution.map((item) => item.count));
  const w = 440, h = 150, pad = 22, bw = (w - pad * 2) / 11;
  return (
    <svg className="eg-columns" viewBox={`0 0 ${w} ${h + 24}`} width="100%" role="img" aria-label={`Scores: ${distribution.map((item) => `${item.value}: ${item.count}`).join(", ")}`}>
      <line x1={pad} x2={w - pad} y1={h} y2={h} stroke="var(--line)" />
      {distribution.map((item, index) => {
        const bh = item.count ? Math.max(4, (item.count / max) * (h - 26)) : 0;
        const x = pad + index * bw + 3;
        const color = item.value >= 9 ? ENPS_COLORS.promoter : item.value >= 7 ? "#bfb8a8" : ENPS_COLORS.detractor;
        return (
          <g key={item.value}>
            <rect x={pad + index * bw} y={0} width={bw} height={h} fill="transparent"><title>{`Score ${item.value}: ${item.count}`}</title></rect>
            {bh > 0 && <path d={`M${x},${h} V${h - bh + 4} q0,-4 4,-4 h${bw - 14} q4,0 4,4 V${h} Z`} fill={color}><title>{`Score ${item.value}: ${item.count}`}</title></path>}
            {item.count > 0 && <text x={x + (bw - 6) / 2} y={h - bh - 6} textAnchor="middle" className="eg-value">{item.count}</text>}
            <text x={x + (bw - 6) / 2} y={h + 16} textAnchor="middle" className="eg-axis">{item.value}</text>
          </g>
        );
      })}
    </svg>
  );
}

/** Horizontal bars for single / multiple choice. */
export function ChoiceBars({ options, total, highlight }: { options: { option: string; count: number; pct: number }[]; total: number; highlight?: string[] }) {
  const max = Math.max(1, ...options.map((item) => item.count));
  const leader = options.reduce((best, item) => (item.count > best ? item.count : best), 0);
  return (
    <ul className="eg-bars" aria-label={`${total} answers`}>
      {options.map((item) => (
        <li key={item.option} className={`${item.count && item.count === leader ? "lead" : ""} ${highlight?.includes(item.option) ? "mine" : ""}`} title={`${item.option}: ${item.count} (${item.pct}%)`}>
          <span className="eg-bar-label">{item.option}</span>
          <span className="eg-bar-track" aria-hidden="true"><i style={{ width: `${(item.count / max) * 100}%` }} /></span>
          <span className="eg-bar-value"><b>{item.pct}%</b><small>{item.count}</small></span>
        </li>
      ))}
    </ul>
  );
}

/** Response ring: responded / invited. */
export function ResponseRing({ value, total, size = 92 }: { value: number; total: number; size?: number }) {
  const pct = total ? value / total : 0;
  const r = size / 2 - 7, c = 2 * Math.PI * r;
  return (
    <svg className="eg-ring" width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${value} of ${total} responded (${Math.round(pct * 100)}%)`}>
      <circle cx={size / 2} cy={size / 2} r={r} stroke="#ece8de" strokeWidth={8} fill="none" />
      <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--accent)" strokeWidth={8} fill="none" strokeDasharray={`${c * pct} ${c}`} strokeLinecap="round" transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" className="eg-ring-text">{Math.round(pct * 100)}%</text>
    </svg>
  );
}

/** Daily responses as columns with a cumulative line on the same count axis. */
export function TrendChart({ points, invited }: { points: { day: string; count: number }[]; invited: number }) {
  const [hover, setHover] = useState<number | null>(null);
  if (!points.length) return <p className="eg-muted">No responses yet.</p>;
  const w = 560, h = 150, left = 30, right = 12, top = 12, bottom = 24;
  let running = 0;
  const cumulative = points.map((point) => (running += point.count));
  const max = Math.max(1, invited || running, running);
  const step = (w - left - right) / points.length;
  const y = (value: number) => top + (h - top - bottom) * (1 - value / max);
  const line = cumulative.map((value, index) => `${index ? "L" : "M"}${left + step * index + step / 2},${y(value)}`).join(" ");
  const fmt = (day: string) => new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(new Date(`${day}T00:00:00`));
  return (
    <div className="eg-trend">
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" role="img" aria-label={`Responses by day: ${points.map((point) => `${fmt(point.day)} ${point.count}`).join(", ")}`} onMouseLeave={() => setHover(null)}>
        {[0, 0.5, 1].map((t) => <g key={t}><line x1={left} x2={w - right} y1={y(max * t)} y2={y(max * t)} stroke="#ece8de" /><text x={left - 6} y={y(max * t) + 3} textAnchor="end" className="eg-axis">{Math.round(max * t)}</text></g>)}
        {points.map((point, index) => {
          const x = left + step * index;
          const bw = Math.min(26, step - 4);
          return (
            <g key={point.day} onMouseEnter={() => setHover(index)}>
              <rect x={x} y={top} width={step} height={h - top - bottom} fill={hover === index ? "rgba(21,44,56,.04)" : "transparent"} />
              <rect x={x + (step - bw) / 2} y={y(point.count)} width={bw} height={h - bottom - y(point.count)} rx={2} fill="color-mix(in srgb, var(--accent) 35%, white)" />
            </g>
          );
        })}
        <path d={line} fill="none" stroke="var(--accent)" strokeWidth={2} />
        {cumulative.map((value, index) => <circle key={index} cx={left + step * index + step / 2} cy={y(value)} r={hover === index ? 5 : 3} fill="var(--paper)" stroke="var(--accent)" strokeWidth={2} />)}
        <text x={left} y={h - 6} className="eg-axis">{fmt(points[0].day)}</text>
        {points.length > 1 && <text x={w - right} y={h - 6} textAnchor="end" className="eg-axis">{fmt(points[points.length - 1].day)}</text>}
      </svg>
      {hover !== null && (
        <div className="eg-tooltip" style={{ left: `${((left + step * hover + step / 2) / w) * 100}%` }}>
          <b>{fmt(points[hover].day)}</b><span>{points[hover].count} that day · {cumulative[hover]} total</span>
        </div>
      )}
      <ul className="eg-legend" aria-hidden="true"><li><i style={{ background: "color-mix(in srgb, var(--accent) 35%, white)" }} />Responses per day</li><li><i className="line" />Running total</li></ul>
    </div>
  );
}

/** Small sparkline-style progress bar used in lists. */
export function RateBar({ value }: { value: number }) {
  return <span className="eg-rate" role="img" aria-label={`${value}% responded`}><i style={{ width: `${Math.min(100, value)}%` }} /></span>;
}
