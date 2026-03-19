/**
 * USA Choropleth Heatmap
 *
 * Renders a beautiful, Apple-quality US state map with color-coded
 * fill based on a selected metric (filings, wages, etc.).
 * Supports hover tooltips and click-to-select drill-down.
 *
 * Uses react-simple-maps + us-atlas TopoJSON.
 */
"use client";

import { useState, useMemo, useCallback, memo } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
} from "react-simple-maps";
import { motion, AnimatePresence } from "framer-motion";
import type { StateAggregate } from "@/lib/data/geographic";
import { formatNumber, formatCurrency } from "@/lib/utils/format";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GEO_URL = "/data/us-states-10m.json";

/** FIPS code → State abbreviation mapping */
const FIPS_TO_STATE: Record<string, string> = {
  "01": "AL", "02": "AK", "04": "AZ", "05": "AR", "06": "CA",
  "08": "CO", "09": "CT", "10": "DE", "11": "DC", "12": "FL",
  "13": "GA", "15": "HI", "16": "ID", "17": "IL", "18": "IN",
  "19": "IA", "20": "KS", "21": "KY", "22": "LA", "23": "ME",
  "24": "MD", "25": "MA", "26": "MI", "27": "MN", "28": "MS",
  "29": "MO", "30": "MT", "31": "NE", "32": "NV", "33": "NH",
  "34": "NJ", "35": "NM", "36": "NY", "37": "NC", "38": "ND",
  "39": "OH", "40": "OK", "41": "OR", "42": "PA", "44": "RI",
  "45": "SC", "46": "SD", "47": "TN", "48": "TX", "49": "UT",
  "50": "VT", "51": "VA", "53": "WA", "54": "WV", "55": "WI",
  "56": "WY", "60": "AS", "66": "GU", "69": "MP", "72": "PR",
  "78": "VI",
};

export type MapMetric = "filings" | "approvals" | "employers" | "medianWage" | "approvalRate" | "competitiveness";

const METRIC_LABELS: Record<MapMetric, string> = {
  filings: "Total Filings",
  approvals: "Approvals",
  employers: "Unique Employers",
  medianWage: "Median Wage",
  approvalRate: "Approval Rate",
  competitiveness: "Wage vs Market",
};

// Color scale: from cool-dark to hot-bright (dark theme optimized)
// Low → deep blue/indigo   High → bright amber/orange
const COLOR_STOPS = [
  "#0c1445",  // Lowest — deep navy
  "#1a2980",  // Low
  "#2b5ea7",  // Below avg
  "#3b82f6",  // Average-low — blue
  "#6dbef0",  // Average
  "#a5d8a8",  // Above avg — muted green
  "#f59e0b",  // High — amber
  "#f97316",  // Very high — orange
  "#ef4444",  // Highest — warm red
];

function interpolateColor(t: number): string {
  // t from 0 to 1, interpolate through color stops
  const n = COLOR_STOPS.length - 1;
  const i = Math.min(Math.floor(t * n), n - 1);
  const f = t * n - i;
  return lerpColor(COLOR_STOPS[i], COLOR_STOPS[i + 1], f);
}

function lerpColor(a: string, b: string, t: number): string {
  const ar = parseInt(a.slice(1, 3), 16);
  const ag = parseInt(a.slice(3, 5), 16);
  const ab = parseInt(a.slice(5, 7), 16);
  const br = parseInt(b.slice(1, 3), 16);
  const bg = parseInt(b.slice(3, 5), 16);
  const bb = parseInt(b.slice(5, 7), 16);
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bv = Math.round(ab + (bb - ab) * t);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${bv.toString(16).padStart(2, "0")}`;
}

function formatMetricValue(metric: MapMetric, value: number | null): string {
  if (value == null) return "N/A";
  switch (metric) {
    case "medianWage":
      return formatCurrency(value);
    case "approvalRate":
    case "competitiveness":
      return `${formatNumber(value * 100, 1)}%`;
    default:
      return formatNumber(value);
  }
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface UsaChoroplethProps {
  states: StateAggregate[];
  metric: MapMetric;
  selectedState: string | null;
  onStateSelect: (stateCode: string | null) => void;
}

// ---------------------------------------------------------------------------
// Tooltip Component
// ---------------------------------------------------------------------------

interface TooltipData {
  name: string;
  stateCode: string;
  data: StateAggregate | null;
  x: number;
  y: number;
}

function MapTooltip({ tooltip, metric }: { tooltip: TooltipData; metric: MapMetric }) {
  const { name, stateCode, data } = tooltip;

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 4 }}
      transition={{ duration: 0.15 }}
      className="pointer-events-none fixed z-50"
      style={{ left: tooltip.x + 12, top: tooltip.y - 8 }}
    >
      <div className="bg-[#09090b]/95 border border-white/[0.12] rounded-xl px-4 py-3 shadow-2xl backdrop-blur-xl min-w-[180px]">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-sm font-semibold text-[var(--foreground)]">{name}</span>
          <span className="text-[10px] font-mono text-[var(--muted-foreground)]">{stateCode}</span>
        </div>
        {data ? (
          <div className="space-y-1">
            <TooltipRow label="Filings" value={formatNumber(data.filings)} highlight={metric === "filings"} />
            <TooltipRow label="Approvals" value={formatNumber(data.approvals)} highlight={metric === "approvals"} />
            <TooltipRow label="Employers" value={formatNumber(data.employers)} highlight={metric === "employers"} />
            <TooltipRow label="Median Wage" value={data.medianWage != null ? formatCurrency(data.medianWage) : "N/A"} highlight={metric === "medianWage"} />
            <TooltipRow label="Approval Rate" value={data.approvalRate != null ? `${formatNumber(data.approvalRate * 100, 1)}%` : "N/A"} highlight={metric === "approvalRate"} />
            <TooltipRow label="Wage vs Market" value={data.competitiveness != null ? `${formatNumber(data.competitiveness * 100, 1)}%` : "N/A"} highlight={metric === "competitiveness"} />
          </div>
        ) : (
          <p className="text-xs text-[var(--muted-foreground)]">No data available</p>
        )}
      </div>
    </motion.div>
  );
}

function TooltipRow({ label, value, highlight }: { label: string; value: string; highlight: boolean }) {
  return (
    <div className="flex justify-between gap-4 text-xs">
      <span className={highlight ? "text-amber-400 font-medium" : "text-[var(--muted-foreground)]"}>{label}</span>
      <span className={`font-mono ${highlight ? "text-amber-300 font-semibold" : "text-[var(--foreground)]"}`}>{value}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Legend
// ---------------------------------------------------------------------------

function ColorLegend({ metric, min, max }: { metric: MapMetric; min: number; max: number }) {
  return (
    <div className="flex items-center gap-2 mt-3">
      <span className="text-[10px] text-[var(--muted-foreground)] font-mono shrink-0">
        {formatMetricValue(metric, min)}
      </span>
      <div
        className="flex-1 h-2 rounded-full"
        style={{
          background: `linear-gradient(to right, ${COLOR_STOPS.join(", ")})`,
        }}
      />
      <span className="text-[10px] text-[var(--muted-foreground)] font-mono shrink-0">
        {formatMetricValue(metric, max)}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export const UsaChoropleth = memo(function UsaChoropleth({
  states,
  metric,
  selectedState,
  onStateSelect,
}: UsaChoroplethProps) {
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);

  // Build lookup: stateCode → StateAggregate
  const stateMap = useMemo(() => {
    const m = new Map<string, StateAggregate>();
    for (const s of states) {
      m.set(s.state, s);
    }
    return m;
  }, [states]);

  // Compute min/max for color scale
  const { min, max } = useMemo(() => {
    const values = states
      .map((s) => s[metric])
      .filter((v): v is number => v != null && !isNaN(v));
    if (values.length === 0) return { min: 0, max: 1 };
    return { min: Math.min(...values), max: Math.max(...values) };
  }, [states, metric]);

  const getColor = useCallback(
    (stateCode: string): string => {
      const s = stateMap.get(stateCode);
      if (!s) return "#1a1a2e"; // No data — near-black
      const val = s[metric];
      if (val == null) return "#1a1a2e";
      const range = max - min;
      const t = range > 0 ? (val - min) / range : 0.5;
      return interpolateColor(Math.max(0, Math.min(1, t)));
    },
    [stateMap, metric, min, max]
  );

  const handleMouseEnter = useCallback(
    (geo: { id: string; properties: { name: string } }, evt: React.MouseEvent) => {
      const stateCode = FIPS_TO_STATE[geo.id] ?? "";
      setTooltip({
        name: geo.properties.name,
        stateCode,
        data: stateMap.get(stateCode) ?? null,
        x: evt.clientX,
        y: evt.clientY,
      });
    },
    [stateMap]
  );

  const handleMouseMove = useCallback(
    (evt: React.MouseEvent) => {
      if (tooltip) {
        setTooltip((prev) => prev ? { ...prev, x: evt.clientX, y: evt.clientY } : null);
      }
    },
    [tooltip]
  );

  const handleMouseLeave = useCallback(() => {
    setTooltip(null);
  }, []);

  const handleClick = useCallback(
    (geo: { id: string }) => {
      const stateCode = FIPS_TO_STATE[geo.id] ?? "";
      if (stateCode === selectedState) {
        onStateSelect(null); // Deselect
      } else {
        onStateSelect(stateCode);
      }
    },
    [selectedState, onStateSelect]
  );

  return (
    <div className="relative">
      {/* Map */}
      <ComposableMap
        projection="geoAlbersUsa"
        projectionConfig={{ scale: 1000 }}
        width={800}
        height={500}
        style={{ width: "100%", height: "auto" }}
      >
        <Geographies geography={GEO_URL}>
          {({ geographies }: { geographies: Array<{ rsmKey: string; id: string; properties: { name: string } }> }) =>
            geographies.map((geo) => {
              const stateCode = FIPS_TO_STATE[geo.id] ?? "";
              const isSelected = stateCode === selectedState;
              const fillColor = getColor(stateCode);

              return (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill={fillColor}
                  stroke={isSelected ? "#f59e0b" : "rgba(255,255,255,0.08)"}
                  strokeWidth={isSelected ? 1.5 : 0.5}
                  style={{
                    default: {
                      outline: "none",
                      transition: "fill 0.2s ease, stroke 0.2s ease",
                    },
                    hover: {
                      fill: isSelected ? fillColor : lerpColor(fillColor, "#ffffff", 0.2),
                      stroke: "#f59e0b",
                      strokeWidth: 1.2,
                      outline: "none",
                      cursor: "pointer",
                    },
                    pressed: {
                      fill: lerpColor(fillColor, "#ffffff", 0.3),
                      outline: "none",
                    },
                  }}
                  onMouseEnter={(evt: React.MouseEvent) => handleMouseEnter(geo, evt)}
                  onMouseMove={handleMouseMove}
                  onMouseLeave={handleMouseLeave}
                  onClick={() => handleClick(geo)}
                />
              );
            })
          }
        </Geographies>
      </ComposableMap>

      {/* Color Legend */}
      <div className="px-4 sm:px-8">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-[var(--muted-foreground)]">Low</span>
          <span className="text-[10px] text-[var(--muted-foreground)] font-medium">
            {METRIC_LABELS[metric]}
          </span>
          <span className="text-[10px] text-[var(--muted-foreground)]">High</span>
        </div>
        <ColorLegend metric={metric} min={min} max={max} />
      </div>

      {/* Tooltip */}
      <AnimatePresence>
        {tooltip && <MapTooltip tooltip={tooltip} metric={metric} />}
      </AnimatePresence>
    </div>
  );
});

export default UsaChoropleth;
