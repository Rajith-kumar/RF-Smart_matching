import React from "react";

interface MatchResult {
  network: string;
  components: Record<string, { theory: number; standard: string; unit: string }>;
  reason: string;
}

interface SmithChartProps {
  freq: string;
  freqUnit: string;
  result: MatchResult | null;
  ZLReal: number;
  ZLImag: number;
  Z0: number;
  mode: string;
}

const SmithChart: React.FC<SmithChartProps> = ({
  freq,
  freqUnit,
  result,
  ZLReal,
  ZLImag,
  Z0,
  mode,
}) => {
  const size = 600;
  const center = size / 2;
  const radius = size / 2 - 60;

  // Convert normalized impedance (r + jx) to SVG point on Smith Chart
  const toSVG = (r: number, x: number) => {
    const den = (r + 1) ** 2 + x ** 2;
    const re = (r * r + x * x - 1) / den;
    const im = (2 * x) / den;
    return { x: center + re * radius, y: center - im * radius };
  };

  // Convert normalized admittance (g + jb) to SVG point
  // Y chart is the mirror image: Γ_Y = -Γ_Z
  const toSVGAdmittance = (g: number, b: number) => {
    const den = (g + 1) ** 2 + b ** 2;
    const re = (g * g + b * b - 1) / den;
    const im = (2 * b) / den;
    // Mirror across center for admittance chart
    return { x: center - re * radius, y: center + im * radius };
  };

  const z0 = Z0 || 50;
  const major = [0.2, 0.5, 1, 2, 5];
  const minor = [0.1, 0.3, 0.4, 0.6, 0.7, 0.8, 0.9, 1.2, 1.4, 1.6, 1.8, 2.5, 3, 3.5, 4, 4.5, 7, 8, 9, 10, 15, 20, 40, 50];
  const allValues = [...major, ...minor];

  const getMatchingPath = (): string => {
    if (!result || !result.components) return "";

    const fVal = parseFloat(freq) || 100;
    const multipliers: Record<string, number> = { Hz: 1, KHz: 1e3, MHz: 1e6, GHz: 1e9 };
    const omega = 2 * Math.PI * fVal * (multipliers[freqUnit] || 1e6);
    const STEPS = 60;

    // Current normalized impedance
    let currR = ZLReal / z0;
    let currX = ZLImag / z0;

    const firstPt = toSVG(currR, currX);
    const allPoints: string[] = [`M ${firstPt.x} ${firstPt.y}`];

    // Build component sequence based on network type
    let sequence: { val: number; type: string }[] = [];
    const comps = result.components;
    const isHP = mode === "high_pass";

    if (result.network.includes("L Section")) {
      sequence = !isHP
        ? [
            { val: comps.L_series?.theory, type: "seriesL" },
            { val: comps.C_shunt?.theory, type: "shuntC" },
          ]
        : [
            { val: comps.C_series?.theory, type: "seriesC" },
            { val: comps.L_shunt?.theory, type: "shuntL" },
          ];
    } else if (result.network.includes("Pi Network")) {
      sequence = !isHP
        ? [
            { val: comps.C1?.theory, type: "shuntC" },
            { val: comps.L?.theory, type: "seriesL" },
            { val: comps.C2?.theory, type: "shuntC" },
          ]
        : [
            { val: comps.L1?.theory, type: "shuntL" },
            { val: comps.C?.theory, type: "seriesC" },
            { val: comps.L2?.theory, type: "shuntL" },
          ];
    } else if (result.network.includes("T Network")) {
      sequence = !isHP
        ? [
            { val: comps.L1?.theory, type: "seriesL" },
            { val: comps.C?.theory, type: "shuntC" },
            { val: comps.L2?.theory, type: "seriesL" },
          ]
        : [
            { val: comps.C1?.theory, type: "seriesC" },
            { val: comps.L?.theory, type: "shuntL" },
            { val: comps.C2?.theory, type: "seriesC" },
          ];
    }

    sequence.forEach(({ val, type }) => {
      if (!val) return;

      if (type.startsWith("series")) {
        // Series elements: move along constant-R circle on Z chart
        // Series L: +jωL/Z0 → X increases → counter-clockwise
        // Series C: -1/(ωCZ0) → X decreases → clockwise
        const totalDX =
          type === "seriesL"
            ? (omega * val) / z0
            : -1 / (omega * val * z0);

        for (let i = 1; i <= STEPS; i++) {
          const stepX = currX + (totalDX * i) / STEPS;
          // Plot on Z chart (constant R circle)
          const pt = toSVG(currR, stepX);
          allPoints.push(`L ${pt.x} ${pt.y}`);
        }
        currX += totalDX;
      } else {
        // Shunt elements: move along constant-G circle on Y chart
        // Convert current Z to Y (admittance)
        const den = currR * currR + currX * currX;
        if (den < 1e-12) return;
        const G = currR / den;
        const startB = -currX / den;

        // Shunt C: +ωCZ0 → B increases → clockwise on admittance chart
        // Shunt L: -Z0/(ωL) → B decreases → counter-clockwise on admittance chart
        const totalDB =
          type === "shuntC"
            ? omega * val * z0
            : -z0 / (omega * val);

        for (let i = 1; i <= STEPS; i++) {
          const stepB = startB + (totalDB * i) / STEPS;
          // Plot on Y chart (admittance) using constant-G circle
          const pt = toSVGAdmittance(G, stepB);
          allPoints.push(`L ${pt.x} ${pt.y}`);
        }

        // Convert back to Z for next element
        const finalB = startB + totalDB;
        const finalDen = G * G + finalB * finalB;
        currR = G / finalDen;
        currX = -finalB / finalDen;
      }
    });

    return allPoints.join(" ");
  };

  // Constant resistance circle arc for grid
  const constantRCircle = (r: number) => {
    const cx = center + (r / (r + 1)) * radius;
    const cr = radius / (r + 1);
    return { cx, cy: center, r: cr };
  };

  // Constant reactance arc for grid
  const constantXArc = (x: number) => {
    if (x === 0) return null;
    const cr = radius / Math.abs(x);
    const cx = center + radius;
    const cy = x > 0 ? center - cr : center + cr;
    return { cx, cy, r: cr };
  };

  const pL = toSVG(ZLReal / z0, ZLImag / z0);
  const pM = toSVG(1, 0);
  const matchPath = getMatchingPath();

  return (
    <div className="flex items-center justify-center">
      <svg viewBox={`0 0 ${size} ${size}`} width="100%" style={{ maxWidth: 560 }}>
        <defs>
          <clipPath id="smithClip">
            <circle cx={center} cy={center} r={radius} />
          </clipPath>
          <radialGradient id="smithBg" cx="50%" cy="50%">
            <stop offset="0%" stopColor="hsl(217, 91%, 60%)" stopOpacity="0.03" />
            <stop offset="100%" stopColor="hsl(217, 91%, 60%)" stopOpacity="0.08" />
          </radialGradient>
        </defs>

        {/* Background */}
        <circle cx={center} cy={center} r={radius} fill="url(#smithBg)" stroke="hsl(217, 91%, 60%)" strokeWidth="2" />

        {/* Tick marks */}
        {Array.from({ length: 120 }).map((_, i) => {
          const rad = (i * 3 * Math.PI) / 180;
          const isMajor = (i * 3) % 15 === 0;
          return (
            <line
              key={`tick-${i}`}
              x1={center + Math.cos(rad) * radius}
              y1={center - Math.sin(rad) * radius}
              x2={center + Math.cos(rad) * (radius + (isMajor ? 10 : 5))}
              y2={center - Math.sin(rad) * (radius + (isMajor ? 10 : 5))}
              stroke="hsl(215, 16%, 47%)"
              strokeWidth={isMajor ? 1 : 0.5}
            />
          );
        })}

        {/* Minor impedance grid */}
        <g clipPath="url(#smithClip)" opacity="0.15">
          {minor.map((v) => {
            const rc = constantRCircle(v);
            const xArc = constantXArc(v);
            return (
              <g key={`minor-${v}`}>
                <circle cx={rc.cx} cy={rc.cy} r={rc.r} fill="none" stroke="hsl(215, 16%, 47%)" strokeWidth="0.3" />
                {xArc && (
                  <>
                    <circle cx={xArc.cx} cy={xArc.cy} r={xArc.r} fill="none" stroke="hsl(215, 16%, 47%)" strokeWidth="0.3" />
                    <circle cx={xArc.cx} cy={center + (center - xArc.cy)} r={xArc.r} fill="none" stroke="hsl(215, 16%, 47%)" strokeWidth="0.3" />
                  </>
                )}
              </g>
            );
          })}
        </g>

        {/* Major impedance grid */}
        <g clipPath="url(#smithClip)" opacity="0.4">
          {major.map((v) => {
            const rc = constantRCircle(v);
            const xArc = constantXArc(v);
            return (
              <g key={`major-${v}`}>
                <circle cx={rc.cx} cy={rc.cy} r={rc.r} fill="none" stroke="hsl(217, 91%, 60%)" strokeWidth="0.7" />
                {xArc && (
                  <>
                    <circle cx={xArc.cx} cy={xArc.cy} r={xArc.r} fill="none" stroke="hsl(217, 91%, 60%)" strokeWidth="0.7" />
                    <circle cx={xArc.cx} cy={center + (center - xArc.cy)} r={xArc.r} fill="none" stroke="hsl(217, 91%, 60%)" strokeWidth="0.7" />
                  </>
                )}
              </g>
            );
          })}
        </g>

        {/* Horizontal axis */}
        <line x1={center - radius} y1={center} x2={center + radius} y2={center} stroke="hsl(215, 16%, 47%)" strokeWidth="0.8" />

        {/* Axis labels - R values */}
        {[0.2, 0.5, 1, 2, 5, 10, 20].map((v) => {
          const pt = toSVG(v, 0);
          return (
            <text key={`rlabel-${v}`} x={pt.x} y={pt.y + 14} textAnchor="middle" fontSize="9" fill="hsl(215, 16%, 47%)" fontWeight="600">
              {v}
            </text>
          );
        })}

        {/* Axis labels - X values */}
        {[0.2, 0.5, 1, 2, 5, -0.2, -0.5, -1, -2, -5].map((v) => {
          const pt = toSVG(0, v);
          const angle = Math.atan2(pt.y - center, pt.x - center);
          return (
            <text
              key={`xlabel-${v}`}
              x={pt.x + Math.cos(angle) * 14}
              y={pt.y + Math.sin(angle) * 14}
              textAnchor="middle"
              fontSize="8"
              fill="hsl(215, 16%, 47%)"
              fontWeight="600"
            >
              {v > 0 ? `${v}j` : `${v}j`}
            </text>
          );
        })}

        {/* Matching path */}
        {matchPath && (
          <path
            d={matchPath}
            fill="none"
            stroke="hsl(0, 84%, 60%)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            markerEnd="url(#arrowhead)"
          />
        )}

        {/* Arrow marker */}
        <defs>
          <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill="hsl(0, 84%, 60%)" />
          </marker>
        </defs>

        {/* Load point (ZL) */}
        <circle cx={pL.x} cy={pL.y} r="6" fill="hsl(0, 84%, 60%)" stroke="white" strokeWidth="2" />
        <text x={pL.x + 10} y={pL.y - 10} fontSize="11" fontWeight="700" fill="hsl(0, 84%, 60%)">
          Z_L
        </text>

        {/* Matched point (Z0) */}
        <circle cx={pM.x} cy={pM.y} r="6" fill="hsl(160, 84%, 39%)" stroke="white" strokeWidth="2" />
        <text x={pM.x + 10} y={pM.y - 10} fontSize="11" fontWeight="700" fill="hsl(160, 84%, 39%)">
          Z₀
        </text>
      </svg>
    </div>
  );
};

export default SmithChart;
