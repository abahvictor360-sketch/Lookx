"use client";

import { useState } from "react";

type Day = { day: string; phone: number; image: number };

/**
 * Lookups per day, phone vs image, stacked. Colours validated for CVD
 * separation (dataviz validator): phone = brand green, image = indigo.
 * Legend + hover tooltip + table view, so identity is never colour-alone.
 */
const SERIES = [
  { key: "phone" as const, label: "Phone", color: "#077a54" },
  { key: "image" as const, label: "Image", color: "#5b5fd6" },
];

const W = 640;
const H = 220;
const PAD = { top: 12, right: 8, bottom: 26, left: 32 };

function niceMax(n: number) {
  if (n <= 5) return 5;
  const pow = 10 ** Math.floor(Math.log10(n));
  return Math.ceil(n / pow) * pow;
}

export function LookupsChart({ days }: { days: Day[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);
  const max = niceMax(Math.max(1, ...days.map((d) => d.phone + d.image)));
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const slot = innerW / days.length;
  const barW = Math.min(28, slot * 0.6);
  const y = (v: number) => PAD.top + innerH - (v / max) * innerH;
  const label = (iso: string) => new Date(iso).toLocaleDateString("en-NG", { day: "numeric", month: "short" });
  const ticks = [0, max / 2, max];

  return (
    <figure className="rounded-2xl border border-line bg-white p-5 shadow-sm">
      <figcaption className="flex flex-wrap items-center justify-between gap-3">
        <span className="font-bold text-ink">Lookups per day (last 14 days)</span>
        <span className="flex items-center gap-4 text-sm text-ink-muted">
          {SERIES.map((s) => (
            <span key={s.key} className="flex items-center gap-1.5">
              <span aria-hidden="true" className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
              {s.label}
            </span>
          ))}
          <button type="button" onClick={() => setShowTable((v) => !v)} className="text-xs font-semibold text-brand underline">
            {showTable ? "Show chart" : "Show table"}
          </button>
        </span>
      </figcaption>

      {showTable ? (
        <table className="mt-4 w-full text-sm">
          <thead className="text-left text-ink-muted">
            <tr><th className="py-1 font-medium">Day</th><th className="font-medium">Phone</th><th className="font-medium">Image</th><th className="font-medium">Total</th></tr>
          </thead>
          <tbody className="divide-y divide-line">
            {days.map((d) => (
              <tr key={d.day}><td className="py-1">{label(d.day)}</td><td>{d.phone}</td><td>{d.image}</td><td className="font-semibold">{d.phone + d.image}</td></tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="relative mt-4">
          <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Stacked bar chart of phone and image lookups per day">
            {ticks.map((t) => (
              <g key={t}>
                <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--color-line)" strokeWidth={1} />
                <text x={PAD.left - 6} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--color-ink-muted)">{t}</text>
              </g>
            ))}
            {days.map((d, i) => {
              const x = PAD.left + i * slot + (slot - barW) / 2;
              const phoneTop = y(d.phone);
              const imageTop = y(d.phone + d.image);
              return (
                <g key={d.day} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
                  {/* Hit target larger than the marks */}
                  <rect x={PAD.left + i * slot} y={PAD.top} width={slot} height={innerH} fill="transparent" />
                  {d.phone > 0 && (
                    <path
                      d={`M${x},${y(0)} V${phoneTop + (d.image ? 0 : 4)} ${d.image ? `H${x + barW}` : `Q${x},${phoneTop} ${x + 4},${phoneTop} H${x + barW - 4} Q${x + barW},${phoneTop} ${x + barW},${phoneTop + 4}`} V${y(0)} Z`}
                      fill={SERIES[0].color}
                      opacity={hover === null || hover === i ? 1 : 0.45}
                    />
                  )}
                  {d.image > 0 && (
                    <path
                      // 2px surface gap between stacked segments; rounded data-end on top.
                      d={`M${x},${phoneTop - (d.phone ? 2 : 0)} V${imageTop + 4} Q${x},${imageTop} ${x + 4},${imageTop} H${x + barW - 4} Q${x + barW},${imageTop} ${x + barW},${imageTop + 4} V${phoneTop - (d.phone ? 2 : 0)} Z`}
                      fill={SERIES[1].color}
                      opacity={hover === null || hover === i ? 1 : 0.45}
                    />
                  )}
                  {(i % 2 === 0 || days.length <= 7) && (
                    <text x={x + barW / 2} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--color-ink-muted)">{label(d.day)}</text>
                  )}
                </g>
              );
            })}
          </svg>
          {hover !== null && (
            <div
              className="pointer-events-none absolute top-0 rounded-lg border border-line bg-white px-3 py-2 text-xs shadow-md"
              style={{ left: `${((PAD.left + hover * slot + slot / 2) / W) * 100}%`, transform: "translateX(-50%)" }}
            >
              <p className="font-semibold text-ink">{label(days[hover].day)}</p>
              {SERIES.map((s) => (
                <p key={s.key} className="flex items-center gap-1.5 text-ink-muted">
                  <span aria-hidden="true" className="h-2 w-2 rounded-sm" style={{ background: s.color }} />
                  {s.label}: <span className="font-semibold text-ink">{days[hover][s.key]}</span>
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </figure>
  );
}
