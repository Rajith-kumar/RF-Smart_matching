import React from "react";

interface MatchResult {
  network: string;
  components: Record<string, { theory: number; standard: string; unit: string }>;
  reason: string;
  order?: "series_first" | "shunt_first";
}

interface CircuitSchematicProps {
  result: MatchResult;
  mode: string;
}

const drawInductor = (x: number, y: number, label: string, isHorizontal = true) => (
  <g key={`ind-${x}-${y}`}>
    {isHorizontal ? (
      <path
        d={`M${x},${y} c3,-8 9,-8 12,0 s9,8 12,0 s9,-8 12,0 s9,8 12,0`}
        fill="none"
        stroke="#3b82f6"
        strokeWidth="2"
      />
    ) : (
      <path
        d={`M${x},${y} c-8,3 -8,9 0,12 s8,9 0,12 s-8,9 0,12 s8,9 0,12`}
        fill="none"
        stroke="#3b82f6"
        strokeWidth="2"
      />
    )}
    <text
      x={isHorizontal ? x + 24 : x - 20}
      y={isHorizontal ? y - 12 : y + 28}
      fontSize="11"
      fontWeight="700"
      fill="#1e293b"
      textAnchor="middle"
    >
      {label}
    </text>
  </g>
);

const drawCapacitor = (x: number, y: number, label: string, isHorizontal = true) => (
  <g key={`cap-${x}-${y}`}>
    {isHorizontal ? (
      <>
        <line x1={x} y1={y} x2={x + 20} y2={y} stroke="#3b82f6" strokeWidth="2" />
        <line x1={x + 20} y1={y - 10} x2={x + 20} y2={y + 10} stroke="#3b82f6" strokeWidth="2.5" />
        <line x1={x + 28} y1={y - 10} x2={x + 28} y2={y + 10} stroke="#3b82f6" strokeWidth="2.5" />
        <line x1={x + 28} y1={y} x2={x + 48} y2={y} stroke="#3b82f6" strokeWidth="2" />
      </>
    ) : (
      <>
        <line x1={x} y1={y} x2={x} y2={y + 20} stroke="#3b82f6" strokeWidth="2" />
        <line x1={x - 10} y1={y + 20} x2={x + 10} y2={y + 20} stroke="#3b82f6" strokeWidth="2.5" />
        <line x1={x - 10} y1={y + 28} x2={x + 10} y2={y + 28} stroke="#3b82f6" strokeWidth="2.5" />
        <line x1={x} y1={y + 28} x2={x} y2={y + 48} stroke="#3b82f6" strokeWidth="2" />
      </>
    )}
    <text
      x={isHorizontal ? x + 24 : x - 20}
      y={isHorizontal ? y - 12 : y + 28}
      fontSize="11"
      fontWeight="700"
      fill="#1e293b"
      textAnchor="middle"
    >
      {label}
    </text>
  </g>
);

const CircuitSchematic: React.FC<CircuitSchematicProps> = ({ result, mode }) => {
  if (!result || !result.network || !result.components) return null;
  const comps = result.components;
  const isHP = mode === "high_pass";

  return (
    <svg viewBox="0 0 460 260" className="w-full" style={{ maxWidth: 500 }}>
      {/* Ground symbol */}
      <line x1={200} y1={220} x2={260} y2={220} stroke="#94a3b8" strokeWidth="1.5" />
      <line x1={210} y1={228} x2={250} y2={228} stroke="#94a3b8" strokeWidth="1.5" />
      <line x1={220} y1={236} x2={240} y2={236} stroke="#94a3b8" strokeWidth="1.5" />
      <text x={230} y={252} textAnchor="middle" fontSize="10" fill="#94a3b8" fontWeight="600">GND</text>

      {result.network.includes("L Section") && (
        (() => {
          // Default Topology A (RL < Z0): source — series — shunt — load
          //   seriesX = 140, shuntX = 280
          // Topology B (RL > Z0, order==="shunt_first"): source — shunt — series — load
          //   shuntX = 140, seriesX = 280  (swap)
          const shuntFirst = result.order === "shunt_first";
          const seriesX = shuntFirst ? 260 : 140;
          const shuntX = shuntFirst ? 140 : 280;
          return (
            <g>
              {/* Main horizontal line spans the whole circuit */}
              <line x1={40} y1={100} x2={seriesX} y2={100} stroke="#1e293b" strokeWidth="2" />
              {/* Series element */}
              {isHP
                ? drawCapacitor(seriesX, 100, comps.C_series?.standard || "C", true)
                : drawInductor(seriesX, 100, comps.L_series?.standard || "L", true)}
              <line x1={seriesX + 48} y1={100} x2={400} y2={100} stroke="#1e293b" strokeWidth="2" />
              {/* Shunt element drop */}
              <line x1={shuntX} y1={100} x2={shuntX} y2={110} stroke="#1e293b" strokeWidth="2" />
              {isHP
                ? drawInductor(shuntX, 110, comps.L_shunt?.standard || "L", false)
                : drawCapacitor(shuntX, 110, comps.C_shunt?.standard || "C", false)}
              <line x1={shuntX} y1={158} x2={shuntX} y2={220} stroke="#1e293b" strokeWidth="1.5" />
              <line x1={Math.min(shuntX, 230)} y1={220} x2={Math.max(shuntX, 230)} y2={220} stroke="#1e293b" strokeWidth="1.5" />
            </g>
          );
        })()
      )}

      {result.network.includes("Pi Network") && (
        <g>
          <line x1={40} y1={100} x2={80} y2={100} stroke="#1e293b" strokeWidth="2" />
          {/* Shunt 1 */}
          <line x1={80} y1={100} x2={80} y2={110} stroke="#1e293b" strokeWidth="2" />
          {isHP
            ? drawInductor(80, 110, comps.L1?.standard || "L1", false)
            : drawCapacitor(80, 110, comps.C1?.standard || "C1", false)}
          <line x1={80} y1={158} x2={80} y2={220} stroke="#1e293b" strokeWidth="1.5" />
          {/* Series */}
          <line x1={80} y1={100} x2={160} y2={100} stroke="#1e293b" strokeWidth="2" />
          {isHP
            ? drawCapacitor(160, 100, comps.C?.standard || "C", true)
            : drawInductor(160, 100, comps.L?.standard || "L", true)}
          <line x1={208} y1={100} x2={320} y2={100} stroke="#1e293b" strokeWidth="2" />
          {/* Shunt 2 */}
          <line x1={320} y1={100} x2={320} y2={110} stroke="#1e293b" strokeWidth="2" />
          {isHP
            ? drawInductor(320, 110, comps.L2?.standard || "L2", false)
            : drawCapacitor(320, 110, comps.C2?.standard || "C2", false)}
          <line x1={320} y1={158} x2={320} y2={220} stroke="#1e293b" strokeWidth="1.5" />
          <line x1={320} y1={100} x2={400} y2={100} stroke="#1e293b" strokeWidth="2" />
          <line x1={80} y1={220} x2={320} y2={220} stroke="#1e293b" strokeWidth="1.5" />
        </g>
      )}

      {result.network.includes("T Network") && (
        <g>
          <line x1={40} y1={100} x2={70} y2={100} stroke="#1e293b" strokeWidth="2" />
          {/* Series 1 */}
          {isHP
            ? drawCapacitor(70, 100, comps.C1?.standard || "C1", true)
            : drawInductor(70, 100, comps.L1?.standard || "L1", true)}
          <line x1={118} y1={100} x2={200} y2={100} stroke="#1e293b" strokeWidth="2" />
          {/* Shunt */}
          <line x1={200} y1={100} x2={200} y2={110} stroke="#1e293b" strokeWidth="2" />
          {isHP
            ? drawInductor(200, 110, comps.L?.standard || "L", false)
            : drawCapacitor(200, 110, comps.C?.standard || "C", false)}
          <line x1={200} y1={158} x2={200} y2={220} stroke="#1e293b" strokeWidth="1.5" />
          {/* Series 2 */}
          <line x1={200} y1={100} x2={270} y2={100} stroke="#1e293b" strokeWidth="2" />
          {isHP
            ? drawCapacitor(270, 100, comps.C2?.standard || "C2", true)
            : drawInductor(270, 100, comps.L2?.standard || "L2", true)}
          <line x1={318} y1={100} x2={400} y2={100} stroke="#1e293b" strokeWidth="2" />
        </g>
      )}

      {/* Port labels */}
      <text x={20} y={105} fontSize="11" fontWeight="700" fill="#3b82f6">PORT 1</text>
      <text x={405} y={105} fontSize="11" fontWeight="700" fill="#3b82f6">PORT 2</text>
    </svg>
  );
};

export default CircuitSchematic;
