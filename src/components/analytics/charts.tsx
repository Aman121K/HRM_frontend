"use client";
// Hand-made, accessible SVG charts: bar (grouped/stacked, vertical/horizontal), line, donut, funnel, heatmap, sparkline.
// Every mark has a hover/focus tooltip, multi-series charts have a legend, and every chart can flip to a table view.
import { Table2, ChartColumn } from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { formatValue, type Chart, type Format, type Series } from "./analytics-api";

/** Categorical order validated for adjacent-pair CVD separation on the #fffefa paper surface (see dataviz validator). */
export const PALETTE = ["#00897d", "#eb6834", "#2a78d6", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"];
const OTHER = "#9aa6aa";
const colorAt = (index: number) => PALETTE[index % PALETTE.length];

// ---- utilities ---------------------------------------------------------------------------------------
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    setWidth(element.clientWidth);
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

function niceScale(minValue: number, maxValue: number, integer: boolean, count = 4) {
  let min = Math.min(0, minValue), max = Math.max(0, maxValue);
  if (max === min) max = min + (integer ? 4 : 1);
  const raw = (max - min) / count;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / magnitude;
  let step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * magnitude;
  if (integer) step = Math.max(1, Math.ceil(step));
  min = Math.floor(min / step) * step;
  max = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let value = min; value <= max + step / 1e6; value += step) ticks.push(Math.round(value * 1e6) / 1e6);
  return { min, max, ticks };
}
const isInteger = (format: Format, values: (number | null)[]) => (format === "number" || format === "money") && values.every((value) => value === null || Number.isInteger(value));

function endBar(x: number, y: number, w: number, h: number, dir: "up" | "down" | "right" | "left") {
  if (w <= 0 || h <= 0) return "";
  const r = Math.min(4, dir === "up" || dir === "down" ? w / 2 : h / 2, dir === "up" || dir === "down" ? h : w);
  switch (dir) {
    case "up": return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
    case "down": return `M${x},${y}V${y + h - r}Q${x},${y + h} ${x + r},${y + h}H${x + w - r}Q${x + w},${y + h} ${x + w},${y + h - r}V${y}Z`;
    case "right": return `M${x},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h - r}Q${x + w},${y + h} ${x + w - r},${y + h}H${x}Z`;
    default: return `M${x + w},${y}H${x + r}Q${x},${y} ${x},${y + r}V${y + h - r}Q${x},${y + h} ${x + r},${y + h}H${x + w}Z`;
  }
}
const textWidth = (text: string, size = 11) => text.length * size * 0.58;
const truncate = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

// ---- tooltip -----------------------------------------------------------------------------------------
type TipRow = { color?: string; label: string; value: string };
type Tip = { x: number; y: number; title: string; rows: TipRow[] } | null;
function Tooltip({ tip, width }: { tip: Tip; width: number }) {
  if (!tip) return null;
  const left = Math.min(Math.max(tip.x, 90), Math.max(90, width - 90));
  return (
    <div className="an-tip" style={{ left, top: tip.y }} role="status" aria-live="polite">
      <b>{tip.title}</b>
      {tip.rows.map((row) => (
        <span key={row.label}>{row.color && <i style={{ background: row.color }} />}<em>{row.label}</em><strong>{row.value}</strong></span>
      ))}
    </div>
  );
}

export function Legend({ items }: { items: { label: string; color: string }[] }) {
  return <ul className="an-legend" aria-label="Legend">{items.map((item) => <li key={item.label}><i style={{ background: item.color }} />{item.label}</li>)}</ul>;
}

// ---- bar ---------------------------------------------------------------------------------------------
function BarChart({ categories, series, format, stacked, horizontal, title }: { categories: string[]; series: Series[]; format: Format; stacked?: boolean; horizontal?: boolean; title: string }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [tip, setTip] = useState<Tip>(null);
  const [active, setActive] = useState<number | null>(null);
  const all = series.flatMap((s) => s.values);
  const integer = isInteger(format, all);
  const totals = categories.map((_, index) => series.reduce((sum, s) => sum + Math.max(0, s.values[index] || 0), 0));
  const negatives = categories.map((_, index) => series.reduce((sum, s) => sum + Math.min(0, s.values[index] || 0), 0));
  const maxValue = stacked ? Math.max(0, ...totals) : Math.max(0, ...all.map((value) => value || 0));
  const minValue = stacked ? Math.min(0, ...negatives) : Math.min(0, ...all.map((value) => value || 0));
  const scale = niceScale(minValue, maxValue, integer);
  const rowsFor = (index: number): TipRow[] => [
    ...series.map((s, si) => ({ color: colorAt(si), label: s.name, value: formatValue(s.values[index], format, true) })),
    ...(stacked && series.length > 1 ? [{ label: "Total", value: formatValue(totals[index], format, true) }] : []),
  ];
  const show = (index: number, x: number, y: number) => { setActive(index); setTip({ x, y, title: categories[index], rows: rowsFor(index) }); };
  const hide = () => { setActive(null); setTip(null); };
  const aria = (index: number) => `${categories[index]}: ${series.map((s) => `${s.name} ${formatValue(s.values[index], format, true)}`).join(", ")}`;

  if (horizontal) {
    const labelW = Math.min(Math.max(80, Math.max(...categories.map((c) => textWidth(truncate(c, 24), 12))) + 10), width * 0.42);
    const valueW = 64;
    const barH = stacked || series.length === 1 ? 16 : Math.max(8, Math.floor(20 / series.length));
    const rowH = stacked || series.length === 1 ? 32 : series.length * (barH + 2) + 14;
    const innerW = Math.max(40, width - labelW - valueW);
    const x = (value: number) => labelW + ((value - scale.min) / (scale.max - scale.min || 1)) * innerW;
    const height = categories.length * rowH + 8;
    return (
      <div className="an-plot" ref={ref}>
        {width > 0 && (
          <svg width={width} height={height} role="img" aria-label={`${title}, horizontal bar chart`}>
            <line x1={x(0)} x2={x(0)} y1={0} y2={height - 4} className="an-axis-line" />
            {categories.map((category, index) => {
              const top = index * rowH + 4;
              let cursor = 0;
              return (
                <g key={category} className={active !== null && active !== index ? "an-dim" : ""}>
                  <text x={labelW - 10} y={top + rowH / 2} className="an-cat" textAnchor="end" dominantBaseline="middle">{truncate(category, 24)}</text>
                  {series.map((s, si) => {
                    const value = s.values[index] || 0;
                    if (stacked) {
                      const x0 = x(cursor), x1 = x(cursor + value);
                      cursor += value;
                      const isLast = si === series.length - 1 || series.slice(si + 1).every((next) => !(next.values[index] || 0));
                      return value ? <path key={s.name} d={isLast ? endBar(x0, top + (rowH - barH) / 2, Math.max(0, x1 - x0 - (isLast ? 0 : 2)), barH, "right") : `M${x0},${top + (rowH - barH) / 2}h${Math.max(0, x1 - x0 - 2)}v${barH}h${-Math.max(0, x1 - x0 - 2)}Z`} fill={colorAt(si)} /> : null;
                    }
                    const y = top + (rowH - (series.length * (barH + 2) - 2)) / 2 + si * (barH + 2);
                    const x0 = x(Math.min(0, value)), x1 = x(Math.max(0, value));
                    return <path key={s.name} d={endBar(x0, y, x1 - x0, barH, value < 0 ? "left" : "right")} fill={colorAt(si)} />;
                  })}
                  {(stacked || series.length === 1) && (
                    <text x={x(stacked ? totals[index] : Math.max(0, series[0].values[index] || 0)) + 6} y={top + rowH / 2} className="an-val" dominantBaseline="middle">
                      {series[0].values[index] === null && !stacked ? "Suppressed" : formatValue(stacked ? totals[index] : series[0].values[index], format, true)}
                    </text>
                  )}
                  <rect className="an-hit" x={0} y={top} width={width} height={rowH} tabIndex={0} aria-label={aria(index)}
                    onMouseEnter={() => show(index, x(stacked ? totals[index] : Math.max(0, ...series.map((s) => s.values[index] || 0))), top)} onMouseLeave={hide}
                    onFocus={() => show(index, x(stacked ? totals[index] : Math.max(0, ...series.map((s) => s.values[index] || 0))), top)} onBlur={hide} />
                </g>
              );
            })}
          </svg>
        )}
        <Tooltip tip={tip} width={width} />
      </div>
    );
  }

  const height = 240;
  const tickLabels = scale.ticks.map((tick) => formatValue(tick, format, true));
  const m = { t: 14, r: 8, b: 30, l: Math.max(28, ...tickLabels.map((label) => textWidth(label))) + 10 };
  const innerW = Math.max(40, width - m.l - m.r), innerH = height - m.t - m.b;
  const y = (value: number) => m.t + innerH - ((value - scale.min) / (scale.max - scale.min || 1)) * innerH;
  const band = innerW / Math.max(1, categories.length);
  const groupW = band * 0.7;
  const barW = stacked ? Math.min(groupW, 40) : Math.min(28, (groupW - (series.length - 1) * 2) / series.length);
  const every = Math.max(1, Math.ceil(categories.length / Math.max(1, Math.floor(innerW / 58))));
  return (
    <div className="an-plot" ref={ref}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={`${title}, bar chart`}>
          {scale.ticks.map((tick, index) => (
            <g key={tick}><line x1={m.l} x2={width - m.r} y1={y(tick)} y2={y(tick)} className={tick === 0 ? "an-axis-line" : "an-gridline"} />
              <text x={m.l - 8} y={y(tick)} className="an-tick" textAnchor="end" dominantBaseline="middle">{tickLabels[index]}</text></g>
          ))}
          {categories.map((category, index) => {
            const cx = m.l + band * index + band / 2;
            let up = 0, down = 0;
            return (
              <g key={category + index} className={active !== null && active !== index ? "an-dim" : ""}>
                {series.map((s, si) => {
                  const value = s.values[index] || 0;
                  if (!value) return null;
                  if (stacked) {
                    const base = value >= 0 ? up : down;
                    const next = base + value;
                    if (value >= 0) up = next; else down = next;
                    const top = Math.min(y(base), y(next)), h = Math.abs(y(base) - y(next));
                    const last = series.slice(si + 1).every((other) => !(other.values[index] || 0) || Math.sign(other.values[index] || 0) !== Math.sign(value));
                    return last ? <path key={s.name} d={endBar(cx - barW / 2, top, barW, h, value >= 0 ? "up" : "down")} fill={colorAt(si)} />
                      : <rect key={s.name} x={cx - barW / 2} y={value >= 0 ? top + 2 : top} width={barW} height={Math.max(0, h - 2)} fill={colorAt(si)} />;
                  }
                  const x0 = cx - (series.length * barW + (series.length - 1) * 2) / 2 + si * (barW + 2);
                  const top = Math.min(y(0), y(value)), h = Math.abs(y(0) - y(value));
                  return <path key={s.name} d={endBar(x0, top, barW, h, value >= 0 ? "up" : "down")} fill={colorAt(si)} />;
                })}
                {index % every === 0 && <text x={cx} y={height - 10} className="an-tick" textAnchor="middle">{truncate(category, 10)}</text>}
                <rect className="an-hit" x={m.l + band * index} y={m.t} width={band} height={innerH} tabIndex={0} aria-label={aria(index)}
                  onMouseEnter={() => show(index, cx, m.t)} onMouseLeave={hide} onFocus={() => show(index, cx, m.t)} onBlur={hide} />
              </g>
            );
          })}
        </svg>
      )}
      <Tooltip tip={tip} width={width} />
    </div>
  );
}

// ---- line --------------------------------------------------------------------------------------------
function LineChart({ categories, series, format, title }: { categories: string[]; series: Series[]; format: Format; title: string }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [index, setIndex] = useState<number | null>(null);
  const gradient = useId().replace(/:/g, "");
  const all = series.flatMap((s) => s.values).filter((value): value is number => value !== null);
  const scale = niceScale(Math.min(0, ...all), Math.max(0, ...all), isInteger(format, all));
  const height = 220;
  const tickLabels = scale.ticks.map((tick) => formatValue(tick, format, true));
  const m = { t: 14, r: 14, b: 30, l: Math.max(28, ...tickLabels.map((label) => textWidth(label))) + 10 };
  const innerW = Math.max(40, width - m.l - m.r), innerH = height - m.t - m.b;
  const n = categories.length;
  const x = (i: number) => (n <= 1 ? m.l + innerW / 2 : m.l + (i / (n - 1)) * innerW);
  const y = (value: number) => m.t + innerH - ((value - scale.min) / (scale.max - scale.min || 1)) * innerH;
  const every = Math.max(1, Math.ceil(n / Math.max(1, Math.floor(innerW / 58))));
  const path = (values: (number | null)[]) => values.reduce((d, value, i) => (value === null ? d : `${d}${i === 0 || values[i - 1] === null ? "M" : "L"}${x(i)},${y(value)}`), "");
  const hasData = all.length > 0;
  const pick = (clientX: number, element: Element) => {
    const box = element.getBoundingClientRect();
    const rel = clientX - box.left - m.l;
    setIndex(Math.max(0, Math.min(n - 1, Math.round(n <= 1 ? 0 : (rel / innerW) * (n - 1)))));
  };
  const onKey = (event: KeyboardEvent) => {
    if (event.key === "ArrowRight") { setIndex((value) => Math.min(n - 1, (value ?? -1) + 1)); event.preventDefault(); }
    if (event.key === "ArrowLeft") { setIndex((value) => Math.max(0, (value ?? n) - 1)); event.preventDefault(); }
    if (event.key === "Home") setIndex(0);
    if (event.key === "End") setIndex(n - 1);
  };
  const lastIndex = (values: (number | null)[]) => { for (let i = values.length - 1; i >= 0; i -= 1) if (values[i] !== null) return i; return -1; };
  const latest = series[0] ? lastIndex(series[0].values) : -1;
  const summary = latest >= 0 ? `Latest ${categories[latest]}: ${series.map((s) => `${s.name} ${formatValue(s.values[latest], format, true)}`).join(", ")}.` : "No data.";
  const tip: Tip = index === null ? null : { x: x(index), y: m.t, title: categories[index], rows: series.map((s, si) => ({ color: colorAt(si), label: s.name, value: formatValue(s.values[index], format, true) })) };
  return (
    <div className="an-plot" ref={ref}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={`${title}, line chart. ${summary}`}>
          <defs><linearGradient id={gradient} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={colorAt(0)} stopOpacity=".16" /><stop offset="1" stopColor={colorAt(0)} stopOpacity="0" /></linearGradient></defs>
          {scale.ticks.map((tick, i) => (
            <g key={tick}><line x1={m.l} x2={width - m.r} y1={y(tick)} y2={y(tick)} className={tick === 0 ? "an-axis-line" : "an-gridline"} />
              <text x={m.l - 8} y={y(tick)} className="an-tick" textAnchor="end" dominantBaseline="middle">{tickLabels[i]}</text></g>
          ))}
          {categories.map((category, i) => (i % every === 0 ? <text key={category + i} x={x(i)} y={height - 10} className="an-tick" textAnchor="middle">{category}</text> : null))}
          {hasData && series.length === 1 && (() => {
            const values = series[0].values;
            const segments: string[] = [];
            let start = -1;
            values.forEach((value, i) => {
              if (value !== null && start < 0) start = i;
              if ((value === null || i === values.length - 1) && start >= 0) {
                const end = value === null ? i - 1 : i;
                if (end > start) segments.push(`${path(values.slice(0, end + 1).map((v, j) => (j < start ? null : v)))}L${x(end)},${y(Math.max(scale.min, 0))}L${x(start)},${y(Math.max(scale.min, 0))}Z`);
                start = -1;
              }
            });
            return segments.map((d) => <path key={d} d={d} fill={`url(#${gradient})`} />);
          })()}
          {series.map((s, si) => <path key={s.name} d={path(s.values)} fill="none" stroke={colorAt(si)} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />)}
          {series.map((s, si) => s.values.map((value, i) => (value !== null && (s.values[i - 1] ?? null) === null && (s.values[i + 1] ?? null) === null
            ? <circle key={`${s.name}-iso-${i}`} cx={x(i)} cy={y(value)} r={3} fill={colorAt(si)} /> : null)))}
          {series.map((s, si) => { const li = lastIndex(s.values); return li >= 0 && index === null ? <circle key={`${s.name}-last`} cx={x(li)} cy={y(s.values[li]!)} r={4} fill={colorAt(si)} stroke="var(--paper)" strokeWidth={2} /> : null; })}
          {index !== null && (
            <g>
              <line x1={x(index)} x2={x(index)} y1={m.t} y2={m.t + innerH} className="an-crosshair" />
              {series.map((s, si) => (s.values[index] !== null ? <circle key={s.name} cx={x(index)} cy={y(s.values[index]!)} r={4.5} fill={colorAt(si)} stroke="var(--paper)" strokeWidth={2} /> : null))}
            </g>
          )}
          <rect className="an-hit" x={m.l - 6} y={m.t} width={innerW + 12} height={innerH} tabIndex={0}
            aria-label={`${title}: use left and right arrow keys to read values. ${summary}`}
            onMouseMove={(event) => pick(event.clientX, event.currentTarget.ownerSVGElement!)} onMouseLeave={() => setIndex(null)}
            onFocus={() => setIndex(latest >= 0 ? latest : 0)} onBlur={() => setIndex(null)} onKeyDown={onKey} />
        </svg>
      )}
      <Tooltip tip={tip} width={width} />
    </div>
  );
}

// ---- donut -------------------------------------------------------------------------------------------
function Donut({ slices: raw, format, title }: { slices: { label: string; value: number }[]; format: Format; title: string }) {
  const [active, setActive] = useState<number | null>(null);
  const slices = useMemo(() => {
    const sorted = raw.filter((slice) => slice.value > 0);
    if (sorted.length <= 7) return sorted.map((slice, index) => ({ ...slice, color: colorAt(index) }));
    const head = sorted.slice(0, 6).map((slice, index) => ({ ...slice, color: colorAt(index) }));
    return [...head, { label: `Other (${sorted.length - 6})`, value: sorted.slice(6).reduce((sum, slice) => sum + slice.value, 0), color: OTHER }];
  }, [raw]);
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);
  if (!total) return <p className="an-chart-empty">No data in this period.</p>;
  const size = 184, c = size / 2, outer = 84, inner = 58;
  let angle = -Math.PI / 2;
  const arcs = slices.map((slice) => {
    const sweep = (slice.value / total) * Math.PI * 2;
    const a0 = angle, a1 = angle + sweep;
    angle = a1;
    if (sweep >= Math.PI * 2 - 1e-6) return { ...slice, d: `M${c},${c - outer}A${outer},${outer} 0 1 1 ${c - 0.01},${c - outer}L${c - 0.01},${c - inner}A${inner},${inner} 0 1 0 ${c},${c - inner}Z` };
    const large = sweep > Math.PI ? 1 : 0;
    const p = (r: number, a: number) => `${c + r * Math.cos(a)},${c + r * Math.sin(a)}`;
    return { ...slice, d: `M${p(outer, a0)}A${outer},${outer} 0 ${large} 1 ${p(outer, a1)}L${p(inner, a1)}A${inner},${inner} 0 ${large} 0 ${p(inner, a0)}Z` };
  });
  const focus = active !== null ? slices[active] : null;
  return (
    <div className="an-donut">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${title}, donut chart. ${slices.map((slice) => `${slice.label} ${formatValue(slice.value, format, true)}`).join(", ")}`}>
        {arcs.map((arc, index) => (
          <path key={arc.label} d={arc.d} fill={arc.color} stroke="var(--paper)" strokeWidth={2} className={active !== null && active !== index ? "an-dim" : ""}
            onMouseEnter={() => setActive(index)} onMouseLeave={() => setActive(null)} />
        ))}
        <text x={c} y={c - 4} textAnchor="middle" className="an-donut-total">{formatValue(focus ? focus.value : total, format, true)}</text>
        <text x={c} y={c + 16} textAnchor="middle" className="an-donut-caption">{focus ? `${Math.round((focus.value / total) * 1000) / 10}%` : "total"}</text>
      </svg>
      <ul className="an-donut-legend">
        {slices.map((slice, index) => (
          <li key={slice.label} tabIndex={0} className={active === index ? "active" : ""} onMouseEnter={() => setActive(index)} onMouseLeave={() => setActive(null)} onFocus={() => setActive(index)} onBlur={() => setActive(null)}
            aria-label={`${slice.label}: ${formatValue(slice.value, format, true)}, ${Math.round((slice.value / total) * 1000) / 10}%`}>
            <i style={{ background: slice.color }} /><span>{slice.label}</span><b>{formatValue(slice.value, format, true)}</b><small>{Math.round((slice.value / total) * 100)}%</small>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---- funnel ------------------------------------------------------------------------------------------
const FUNNEL_SHADES = ["#0d5e57", "#00897d", "#2ea396", "#5bb8ad", "#86cbc2"];
function Funnel({ steps, format, title }: { steps: { label: string; value: number }[]; format: Format; title: string }) {
  const max = Math.max(1, ...steps.map((step) => step.value));
  return (
    <ol className="an-funnel" aria-label={`${title}, funnel`}>
      {steps.map((step, index) => {
        const prev = index > 0 ? steps[index - 1].value : null;
        const conversion = prev ? Math.round((step.value / prev) * 100) : null;
        return (
          <li key={step.label} tabIndex={0} aria-label={`${step.label}: ${formatValue(step.value, format)}${conversion !== null ? `, ${conversion}% of previous stage` : ""}`}>
            <span className="an-funnel-label">{step.label}</span>
            <span className="an-funnel-track"><i style={{ width: `${Math.max(step.value ? 4 : 0, (step.value / max) * 100)}%`, background: FUNNEL_SHADES[index % FUNNEL_SHADES.length] }} /></span>
            <b>{formatValue(step.value, format)}</b>
            <small>{conversion === null ? "" : prev ? `${conversion}%` : "—"}</small>
          </li>
        );
      })}
    </ol>
  );
}

// ---- heatmap -----------------------------------------------------------------------------------------
const mix = (from: string, to: string, t: number) => {
  const a = from.match(/\w\w/g)!.map((h) => parseInt(h, 16)), b = to.match(/\w\w/g)!.map((h) => parseInt(h, 16));
  return `rgb(${a.map((value, i) => Math.round(value + (b[i] - value) * t)).join(",")})`;
};
function Heatmap({ rows, cols, values, format, title }: { rows: string[]; cols: string[]; values: (number | null)[][]; format: Format; title: string }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [tip, setTip] = useState<Tip>(null);
  const max = Math.max(0, ...values.flat().map((value) => value || 0));
  const labelW = 40, cellH = 28, gap = 2;
  const cellW = Math.max(12, (width - labelW) / Math.max(1, cols.length));
  const height = rows.length * cellH + 24;
  const every = Math.max(1, Math.ceil(cols.length / Math.max(1, Math.floor((width - labelW) / 50))));
  const fill = (value: number | null) => (!value ? "#f1efe8" : mix("fffefa", "0d5e57", 0.18 + 0.82 * (value / (max || 1))));
  return (
    <div className="an-plot" ref={ref}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={`${title}, heatmap of ${rows.length} rows by ${cols.length} columns; darker means more.`}>
          {rows.map((row, ri) => (
            <g key={row}>
              <text x={labelW - 8} y={ri * cellH + cellH / 2} className="an-cat" textAnchor="end" dominantBaseline="middle">{row}</text>
              {cols.map((col, ci) => {
                const value = values[ri]?.[ci] ?? null;
                const x = labelW + ci * cellW, y = ri * cellH;
                const dark = value !== null && max > 0 && value / max > 0.55;
                const label = `${row}, ${col}: ${formatValue(value || 0, format, true)}`;
                return (
                  <g key={col}>
                    <rect x={x} y={y} width={cellW - gap} height={cellH - gap} rx={2} fill={fill(value)} className="an-cell" tabIndex={0} aria-label={label}
                      onMouseEnter={() => setTip({ x: x + cellW / 2, y, title: `${row} · ${col}`, rows: [{ label: "Value", value: formatValue(value || 0, format, true) }] })} onMouseLeave={() => setTip(null)}
                      onFocus={() => setTip({ x: x + cellW / 2, y, title: `${row} · ${col}`, rows: [{ label: "Value", value: formatValue(value || 0, format, true) }] })} onBlur={() => setTip(null)} />
                    {cellW >= 40 && value ? <text x={x + (cellW - gap) / 2} y={y + (cellH - gap) / 2} textAnchor="middle" dominantBaseline="middle" className={`an-cell-label${dark ? " on-dark" : ""}`} pointerEvents="none">{Math.round(value * 10) / 10}</text> : null}
                  </g>
                );
              })}
            </g>
          ))}
          {cols.map((col, ci) => (ci % every === 0 ? <text key={col} x={labelW + ci * cellW + (cellW - gap) / 2} y={height - 6} className="an-tick" textAnchor="middle">{col}</text> : null))}
        </svg>
      )}
      <div className="an-scale" aria-hidden="true"><span>0</span><i style={{ background: `linear-gradient(90deg, ${fill(max * 0.001 || 0.001)}, ${fill(max || 1)})` }} /><span>{formatValue(max, format, true)}</span></div>
      <Tooltip tip={tip} width={width} />
    </div>
  );
}

// ---- sparkline ---------------------------------------------------------------------------------------
export function Sparkline({ values, color = PALETTE[0] }: { values: (number | null)[]; color?: string }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const points = values.map((value, index) => ({ value, index })).filter((point): point is { value: number; index: number } => point.value !== null);
  const height = 34;
  if (points.length < 2) return <div ref={ref} className="an-spark empty" aria-hidden="true" />;
  const min = Math.min(...points.map((p) => p.value)), max = Math.max(...points.map((p) => p.value));
  const x = (index: number) => 3 + (index / Math.max(1, values.length - 1)) * (width - 6);
  const y = (value: number) => 4 + (1 - (value - min) / (max - min || 1)) * (height - 8);
  const d = points.map((p, i) => `${i ? "L" : "M"}${x(p.index)},${y(p.value)}`).join("");
  const last = points[points.length - 1];
  return (
    <div ref={ref} className="an-spark" aria-hidden="true">
      {width > 0 && <svg width={width} height={height}><path d={`${d}L${x(last.index)},${height}L${x(points[0].index)},${height}Z`} fill={color} opacity=".08" /><path d={d} fill="none" stroke={color} strokeWidth={1.75} strokeLinejoin="round" /><circle cx={x(last.index)} cy={y(last.value)} r={3} fill={color} stroke="var(--paper)" strokeWidth={1.5} /></svg>}
    </div>
  );
}

// ---- table view --------------------------------------------------------------------------------------
function ChartTable({ chart }: { chart: Chart }) {
  let head: string[] = [], body: string[][] = [];
  if (chart.type === "bar" || chart.type === "line") { head = ["", ...chart.series.map((s) => s.name)]; body = chart.categories.map((category, i) => [category, ...chart.series.map((s) => formatValue(s.values[i], chart.format))]); }
  if (chart.type === "donut") { const total = chart.slices.reduce((s, x) => s + x.value, 0); head = ["", "Value", "Share"]; body = chart.slices.map((slice) => [slice.label, formatValue(slice.value, chart.format), total ? `${Math.round((slice.value / total) * 1000) / 10}%` : "—"]); }
  if (chart.type === "funnel") { head = ["Stage", "Count"]; body = chart.steps.map((step) => [step.label, formatValue(step.value, chart.format)]); }
  if (chart.type === "heatmap") { head = ["", ...chart.cols]; body = chart.rows.map((row, ri) => [row, ...chart.cols.map((_, ci) => formatValue(chart.values[ri]?.[ci] ?? 0, chart.format))]); }
  return (
    <div className="an-chart-table" tabIndex={0} role="region" aria-label={`${chart.title} data table`}>
      <table><thead><tr>{head.map((cell, i) => <th key={i} scope="col">{cell}</th>)}</tr></thead>
        <tbody>{body.map((row, ri) => <tr key={ri}>{row.map((cell, ci) => (ci === 0 ? <th key={ci} scope="row">{cell}</th> : <td key={ci}>{cell}</td>))}</tr>)}</tbody></table>
    </div>
  );
}

// ---- card --------------------------------------------------------------------------------------------
function hasData(chart: Chart) {
  if (chart.type === "bar" || chart.type === "line") return chart.categories.length > 0 && chart.series.some((s) => s.values.some((value) => value !== null && value !== 0));
  if (chart.type === "donut") return chart.slices.some((slice) => slice.value > 0);
  if (chart.type === "funnel") return chart.steps.some((step) => step.value > 0);
  if (chart.type === "heatmap") return chart.values.some((row) => row.some((value) => value));
  return false;
}

export function ChartCard({ chart, action, className = "" }: { chart: Chart; action?: ReactNode; className?: string }) {
  const [table, setTable] = useState(false);
  const titleId = useId();
  const toggle = useCallback(() => setTable((value) => !value), []);
  const empty = chart.type === "empty" || !hasData(chart);
  const legend = (chart.type === "bar" || chart.type === "line") && chart.series.length > 1 ? chart.series.map((s, i) => ({ label: s.name, color: colorAt(i) })) : null;
  return (
    <section className={`an-card an-chart ${chart.wide ? "wide" : ""} ${className}`} aria-labelledby={titleId}>
      <header>
        <div><h3 id={titleId}>{chart.title}</h3>{chart.subtitle && <p>{chart.subtitle}</p>}</div>
        <div className="an-card-actions">
          {action}
          {!empty && <button type="button" className="cw-icon-button" onClick={toggle} aria-pressed={table} title={table ? "Show chart" : "Show as table"} aria-label={table ? `Show ${chart.title} as chart` : `Show ${chart.title} as table`}>{table ? <ChartColumn size={16} /> : <Table2 size={16} />}</button>}
        </div>
      </header>
      {legend && !table && !empty && <Legend items={legend} />}
      {empty ? <p className="an-chart-empty">{chart.type === "empty" ? chart.message : "No activity in this period yet."}</p>
        : table ? <ChartTable chart={chart} />
        : chart.type === "bar" ? <BarChart {...chart} />
        : chart.type === "line" ? <LineChart {...chart} />
        : chart.type === "donut" ? <Donut {...chart} />
        : chart.type === "funnel" ? <Funnel {...chart} />
        : chart.type === "heatmap" ? <Heatmap {...chart} /> : null}
      {chart.note && <p className="an-chart-note">{chart.note}</p>}
    </section>
  );
}
