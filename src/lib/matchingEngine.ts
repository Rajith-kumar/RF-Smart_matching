/**
 * Client-side impedance matching computation.
 * Computes L-section, Pi, and T networks for low-pass and high-pass designs.
 */

interface ComponentData {
  theory: number;
  standard: string;
  unit: string;
}

export interface MatchResult {
  network: string;
  components: Record<string, ComponentData>;
  reason: string;
}

const E12_VALUES = [
  1.0, 1.2, 1.5, 1.8, 2.2, 2.7, 3.3, 3.9, 4.7, 5.6, 6.8, 8.2,
];

function toStandard(value: number, unit: string): string {
  // Find nearest E12 standard value
  const exp = Math.floor(Math.log10(value));
  const mantissa = value / Math.pow(10, exp);

  let bestVal = E12_VALUES[0];
  let bestDiff = Math.abs(mantissa - E12_VALUES[0]);
  for (const e of E12_VALUES) {
    const diff = Math.abs(mantissa - e);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestVal = e;
    }
  }

  const stdValue = bestVal * Math.pow(10, exp);

  // Format with appropriate prefix
  if (unit === "H") {
    if (stdValue >= 1e-6 && stdValue < 1e-3) return `${(stdValue * 1e6).toFixed(1)} µH`;
    if (stdValue >= 1e-9 && stdValue < 1e-6) return `${(stdValue * 1e9).toFixed(1)} nH`;
    if (stdValue >= 1e-3) return `${(stdValue * 1e3).toFixed(1)} mH`;
    return `${stdValue.toExponential(2)} H`;
  } else {
    if (stdValue >= 1e-12 && stdValue < 1e-9) return `${(stdValue * 1e12).toFixed(1)} pF`;
    if (stdValue >= 1e-9 && stdValue < 1e-6) return `${(stdValue * 1e9).toFixed(1)} nF`;
    if (stdValue >= 1e-6) return `${(stdValue * 1e6).toFixed(1)} µF`;
    return `${stdValue.toExponential(2)} F`;
  }
}

export function computeMatch(
  ZL_real: number,
  ZL_imag: number,
  Z0: number,
  freqHz: number,
  mode: string
): MatchResult[] {
  const RL = ZL_real;
  const XL = ZL_imag;
  const omega = 2 * Math.PI * freqHz;
  const results: MatchResult[] = [];
  const isHP = mode === "high_pass";
  const ratio = RL / Z0; // impedance ratio for network selection

  // --- L-Section Matching ---
  // Case: RL > Z0 (shunt element first, then series)
  // Case: RL < Z0 (series element first, then shunt)
  // For RL === Z0 with reactance, we still need to cancel the reactance

  if (RL !== Z0 || XL !== 0) {
    try {
      if (RL > Z0) {
        // Q factor
        const Q = Math.sqrt(RL / Z0 - 1);
        const X_series = Q * Z0 - XL; // series reactance needed
        const B_shunt = Q / RL; // shunt susceptance needed

        if (!isHP) {
          // Low-pass: series L, shunt C
          const L_series = Math.abs(X_series) / omega;
          const C_shunt = B_shunt / omega;

          if (L_series > 0 && C_shunt > 0) {
            results.push({
              network: "L Section (Type 1)",
              components: {
                L_series: { theory: L_series, standard: toStandard(L_series, "H"), unit: "H" },
                C_shunt: { theory: C_shunt, standard: toStandard(C_shunt, "F"), unit: "F" },
              },
              reason: `RL (${RL}Ω) > Z0 (${Z0}Ω): L-network with series inductor (${(L_series * 1e9).toFixed(1)} nH) and shunt capacitor (${(C_shunt * 1e12).toFixed(1)} pF). Q = ${Q.toFixed(2)}.`,
            });
          }
        } else {
          // High-pass: series C, shunt L
          const C_series = 1 / (omega * Math.abs(X_series));
          const L_shunt = 1 / (omega * B_shunt);

          if (C_series > 0 && L_shunt > 0) {
            results.push({
              network: "L Section (Type 1)",
              components: {
                C_series: { theory: C_series, standard: toStandard(C_series, "F"), unit: "F" },
                L_shunt: { theory: L_shunt, standard: toStandard(L_shunt, "H"), unit: "H" },
              },
              reason: `RL (${RL}Ω) > Z0 (${Z0}Ω): High-pass L-network with series capacitor and shunt inductor. Q = ${Q.toFixed(2)}.`,
            });
          }
        }
      } else if (RL < Z0) {
        const Q = Math.sqrt(Z0 / RL - 1);
        const X_series = Q * RL;
        const B_shunt = Q / Z0;

        if (!isHP) {
          const L_series = (X_series - XL) / omega;
          const C_shunt = B_shunt / omega;

          if (L_series > 0 && C_shunt > 0) {
            results.push({
              network: "L Section (Type 2)",
              components: {
                L_series: { theory: L_series, standard: toStandard(L_series, "H"), unit: "H" },
                C_shunt: { theory: C_shunt, standard: toStandard(C_shunt, "F"), unit: "F" },
              },
              reason: `RL (${RL}Ω) < Z0 (${Z0}Ω): L-network with series inductor and shunt capacitor. Q = ${Q.toFixed(2)}.`,
            });
          }
        } else {
          const C_series = 1 / (omega * Math.abs(X_series - XL));
          const L_shunt = 1 / (omega * B_shunt);

          if (C_series > 0 && L_shunt > 0) {
            results.push({
              network: "L Section (Type 2)",
              components: {
                C_series: { theory: C_series, standard: toStandard(C_series, "F"), unit: "F" },
                L_shunt: { theory: L_shunt, standard: toStandard(L_shunt, "H"), unit: "H" },
              },
              reason: `RL (${RL}Ω) < Z0 (${Z0}Ω): High-pass L-network with series capacitor and shunt inductor. Q = ${Q.toFixed(2)}.`,
            });
          }
        }
      } else {
        // RL === Z0, just cancel reactance
        if (XL > 0) {
          const C_series = 1 / (omega * XL);
          results.push({
            network: "L Section (Reactance Cancel)",
            components: {
              C_series: { theory: C_series, standard: toStandard(C_series, "F"), unit: "F" },
            },
            reason: `RL = Z0, cancelling inductive reactance with series capacitor.`,
          });
        } else if (XL < 0) {
          const L_series = Math.abs(XL) / omega;
          results.push({
            network: "L Section (Reactance Cancel)",
            components: {
              L_series: { theory: L_series, standard: toStandard(L_series, "H"), unit: "H" },
            },
            reason: `RL = Z0, cancelling capacitive reactance with series inductor.`,
          });
        }
      }
    } catch {
      // Skip if math fails
    }

    // --- Pi Network ---
    try {
      const Q_pi = 3; // Design Q for Pi network
      const R_virt = Math.min(RL, Z0) / (1 + Q_pi * Q_pi);
      if (R_virt > 0) {
        const Q1 = Math.sqrt(RL / R_virt - 1);
        const Q2 = Math.sqrt(Z0 / R_virt - 1);

        if (!isHP) {
          const C1 = Q1 / (omega * RL);
          const L = R_virt * (Q1 + Q2) / omega;
          const C2 = Q2 / (omega * Z0);

          if (C1 > 0 && L > 0 && C2 > 0) {
            results.push({
              network: "Pi Network",
              components: {
                C1: { theory: C1, standard: toStandard(C1, "F"), unit: "F" },
                L: { theory: L, standard: toStandard(L, "H"), unit: "H" },
                C2: { theory: C2, standard: toStandard(C2, "F"), unit: "F" },
              },
              reason: `Pi network: Q=${Q_pi}. Two shunt capacitors with series inductor — ideal for high-impedance loads.`,
            });
          }
        } else {
          const L1 = RL / (omega * Q1);
          const C = 1 / (omega * R_virt * (Q1 + Q2));
          const L2 = Z0 / (omega * Q2);

          if (L1 > 0 && C > 0 && L2 > 0) {
            results.push({
              network: "Pi Network",
              components: {
                L1: { theory: L1, standard: toStandard(L1, "H"), unit: "H" },
                C: { theory: C, standard: toStandard(C, "F"), unit: "F" },
                L2: { theory: L2, standard: toStandard(L2, "H"), unit: "H" },
              },
              reason: `High-pass Pi network with shunt inductors and series capacitor.`,
            });
          }
        }
      }
    } catch {
      // Skip
    }

    // --- T Network ---
    try {
      const Q_t = 3;
      const R_virt = Math.max(RL, Z0) * (1 + Q_t * Q_t);
      const Q1 = Math.sqrt(R_virt / RL - 1);
      const Q2 = Math.sqrt(R_virt / Z0 - 1);

      if (!isHP) {
        const L1 = (Q1 * RL - XL) / omega;
        const C = 1 / (omega * R_virt * (Q1 + Q2));
        const L2 = Q2 * Z0 / omega;

        if (L1 > 0 && C > 0 && L2 > 0) {
          results.push({
            network: "T Network",
            components: {
              L1: { theory: L1, standard: toStandard(L1, "H"), unit: "H" },
              C: { theory: C, standard: toStandard(C, "F"), unit: "F" },
              L2: { theory: L2, standard: toStandard(L2, "H"), unit: "H" },
            },
            reason: `T network: Q=${Q_t}. Two series inductors with shunt capacitor — ideal for low-impedance loads.`,
          });
        }
      } else {
        const C1 = 1 / (omega * Q1 * RL);
        const L = R_virt / (omega * (Q1 + Q2));
        const C2 = 1 / (omega * Q2 * Z0);

        if (C1 > 0 && L > 0 && C2 > 0) {
          results.push({
            network: "T Network",
            components: {
              C1: { theory: C1, standard: toStandard(C1, "F"), unit: "F" },
              L: { theory: L, standard: toStandard(L, "H"), unit: "H" },
              C2: { theory: C2, standard: toStandard(C2, "F"), unit: "F" },
            },
            reason: `High-pass T network with series capacitors and shunt inductor.`,
          });
        }
      }
    } catch {
      // Skip
    }
  }

  // Sort results: prioritize based on impedance ratio
  // High ZL (ratio > 2) → Pi network best (shunt-first topology steps down)
  // Low ZL (ratio < 0.5) → T network best (series-first topology steps up)
  // Moderate ZL → L-section is simplest and sufficient
  const priority = (name: string): number => {
    if (ratio > 2) {
      // High impedance: Pi > L > T
      if (name.includes("Pi")) return 0;
      if (name.includes("L Section")) return 1;
      if (name.includes("T Network")) return 2;
    } else if (ratio < 0.5) {
      // Low impedance: T > L > Pi
      if (name.includes("T Network")) return 0;
      if (name.includes("L Section")) return 1;
      if (name.includes("Pi")) return 2;
    } else {
      // Moderate: L > Pi > T
      if (name.includes("L Section")) return 0;
      if (name.includes("Pi")) return 1;
      if (name.includes("T Network")) return 2;
    }
    return 3;
  };

  results.sort((a, b) => priority(a.network) - priority(b.network));

  // Update reason with recommendation context
  if (results.length > 0) {
    const rec = ratio > 2 ? "Pi network recommended for high-impedance loads" :
                ratio < 0.5 ? "T network recommended for low-impedance loads" :
                "L-section recommended for moderate impedance ratio";
    results[0].reason = `${rec}. ${results[0].reason}`;
  }

  return results;
}
