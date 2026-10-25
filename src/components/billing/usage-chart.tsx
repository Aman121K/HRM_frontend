"use client";
import styles from "./billing.module.css";

type Point = { label: string; value: number; muted?: boolean; title?: string };

/**
 * Hand-made accessible bar chart: the SVG has role="img" with every value spelled out in its label, each bar has a
 * <title> tooltip, and the legend is real text.
 */
export function UsageChart({ points, peak, title, unit = "employees" }: { points: Point[]; peak?: number | null; title: string; unit?: string }) {
  const width = 640, height = 190, left = 34, bottom = 22, top = 10;
  const max = Math.max(1, peak || 0, ...points.map((point) => point.value));
  const scale = (value: number) => (height - bottom - top) * (value / max);
  const slot = (width - left) / Math.max(points.length, 1);
  const barWidth = Math.max(3, Math.min(28, slot * 0.7));
  const ticks = [...new Set([0, Math.round(max / 2), max])];
  const description = `${title}: ${points.map((point) => `${point.label} ${point.value}`).join(", ")}${peak ? `. Peak ${peak} ${unit}.` : ""}`;
  if (!points.length) return <p className="cw-help">No usage recorded yet — the nightly snapshot fills this in.</p>;
  return (
    <figure style={{ margin: 0 }}>
      <svg className={styles.chart} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={description}>
        {ticks.map((tick) => (
          <g key={tick}>
            <line className={styles.grid} x1={left} x2={width} y1={height - bottom - scale(tick)} y2={height - bottom - scale(tick)} />
            <text x={left - 6} y={height - bottom - scale(tick) + 3} textAnchor="end">{tick}</text>
          </g>
        ))}
        {points.map((point, index) => {
          const x = left + index * slot + (slot - barWidth) / 2;
          const h = scale(point.value);
          const showLabel = points.length <= 12 || index % Math.ceil(points.length / 10) === 0;
          return (
            <g key={point.label}>
              <rect className={`${styles.bar} ${point.muted ? styles.backfill : ""}`} x={x} y={height - bottom - h} width={barWidth} height={Math.max(h, 0.5)}>
                <title>{point.title || `${point.label}: ${point.value} ${unit}`}</title>
              </rect>
              {showLabel && <text x={x + barWidth / 2} y={height - 6} textAnchor="middle">{point.label}</text>}
            </g>
          );
        })}
        {peak ? <line className={styles.peak} x1={left} x2={width} y1={height - bottom - scale(peak)} y2={height - bottom - scale(peak)} /> : null}
      </svg>
      <figcaption className={styles.legend}>
        <span><i />Recorded nightly</span>
        {points.some((point) => point.muted) && <span><i className={styles.backfill} />Backfilled estimate</span>}
        {peak ? <span><i className={styles.peak} />Peak {peak}</span> : null}
      </figcaption>
    </figure>
  );
}
