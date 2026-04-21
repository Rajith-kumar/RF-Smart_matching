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
        // For RL > Z0: shunt element across load, then series element to source.
        // Convert load to parallel: Rp = (RL^2 + XL^2)/RL, Bp = -XL/(RL^2+XL^2)
        // After adding shunt B_add, parallel R is still Rp, total B = Bp + B_add.
        // Need parallel R after transform = Z0 with some series reactance to cancel.
        // Standard: Q = sqrt(Rp/Z0 - 1)
        const Rp = (RL * RL + XL * XL) / RL;
        const Bp = -XL / (RL * RL + XL * XL);
        if (Rp > Z0) {
          const Q = Math.sqrt(Rp / Z0 - 1);
          // Two solutions for shunt susceptance: B_total = ±Q/Rp
          // Then series X needed to cancel = ∓Q*Z0
          // Low-pass needs shunt C (B_add > 0) and series L (X > 0): pick B_total = +Q/Rp, X_series = +Q*Z0
          // High-pass needs shunt L (B_add < 0) and series C (X < 0): pick B_total = -Q/Rp, X_series = -Q*Z0
          if (!isHP) {
            const B_add = Q / Rp - Bp;
            const X_series = Q * Z0;
            const C_shunt = B_add / omega;
            const L_series = X_series / omega;
            if (L_series > 0 && C_shunt > 0) {
              results.push({
                network: "L Section (Type 1)",
                components: {
                  L_series: { theory: L_series, standard: toStandard(L_series, "H"), unit: "H" },
                  C_shunt: { theory: C_shunt, standard: toStandard(C_shunt, "F"), unit: "F" },
                },
                reason: `RL (${RL}Ω) > Z0 (${Z0}Ω): L-network with series inductor and shunt capacitor. Q = ${Q.toFixed(2)}.`,
              });
            }
          } else {
            const B_add = -Q / Rp - Bp;
            const X_series = -Q * Z0;
            const L_shunt = B_add < 0 ? 1 / (omega * Math.abs(B_add)) : 0;
            const C_series = X_series < 0 ? 1 / (omega * Math.abs(X_series)) : 0;
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
        }
      } else if (RL < Z0) {
        const Q = Math.sqrt(Z0 / RL - 1);
        const B_shunt = Q / Z0;

        if (!isHP) {
          // LP RL<Z0: junction X must be +Q*RL; series L adds (Q*RL - XL)
          const X_add = Q * RL - XL;
          const L_series = X_add / omega;
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
          // HP RL<Z0: junction X must be -Q*RL; series C adds (-Q*RL - XL), must be negative
          const X_add = -Q * RL - XL;
          const C_series = X_add < 0 ? 1 / (omega * Math.abs(X_add)) : 0;
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

    // --- Pi Network (back-to-back L sections through low virtual R) ---
    // Pi network steps down to a virtual R lower than min(Rp, Z0)
    try {
      const Zmag2 = RL * RL + XL * XL;
      const Rp = Zmag2 / RL; // parallel equivalent of load
      const Bp_load = -XL / Zmag2; // load's parallel susceptance

      // Choose R_virt so that Q on both sides is reasonable; pick min/10 (Q≈3)
      const R_virt = Math.min(Rp, Z0) / 10;
      if (R_virt > 0 && Rp > R_virt && Z0 > R_virt) {
        const Q1 = Math.sqrt(Rp / R_virt - 1);
        const Q2 = Math.sqrt(Z0 / R_virt - 1);

        if (!isHP) {
          // Low-pass Pi: shunt C1, series L (sum of two L's), shunt C2
          const B_C1_total = Q1 / Rp;
          const C1_susceptance = B_C1_total - Bp_load;
          const C1 = C1_susceptance / omega;
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
              reason: `Pi network (Q1=${Q1.toFixed(2)}, Q2=${Q2.toFixed(2)}): two shunt capacitors with series inductor.`,
            });
          }
        } else {
          // High-pass Pi: shunt L1, series C, shunt L2
          const B_L1_total = -Q1 / Rp;
          const L1_susceptance = B_L1_total - Bp_load;
          const L1 = (L1_susceptance < 0) ? -1 / (omega * L1_susceptance) : 0;
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
              reason: `High-pass Pi (Q1=${Q1.toFixed(2)}, Q2=${Q2.toFixed(2)}): shunt inductors with series capacitor.`,
            });
          }
        }
      }
    } catch {
      // Skip
    }

    // --- T Network (back-to-back L sections through high virtual R) ---
    // T network steps up to a virtual R higher than max(RL, Z0)
    try {
      const R_virt = Math.max(RL, Z0) * 10; // Q ≈ 3
      const Q1 = Math.sqrt(R_virt / RL - 1);
      const Q2 = Math.sqrt(R_virt / Z0 - 1);

      if (!isHP) {
        // Low-pass T: series L1 (absorbing XL), shunt C, series L2
        const L1 = (Q1 * RL - XL) / omega;
        // Shunt C must transform R_virt down to R_virt/(1+Q1^2) on the load side
        // Actually after series L1, impedance is RL + j(Q1*RL). Parallel form: Rp = RL*(1+Q1^2) = R_virt, Bp = Q1/(RL*(1+Q1^2)) = Q1/R_virt
        // Need shunt B to cancel and add: total shunt B = Q1/R_virt + Q2/R_virt
        const C = (Q1 + Q2) / (omega * R_virt);
        const L2 = Q2 * Z0 / omega;

        if (L1 > 0 && C > 0 && L2 > 0) {
          results.push({
            network: "T Network",
            components: {
              L1: { theory: L1, standard: toStandard(L1, "H"), unit: "H" },
              C: { theory: C, standard: toStandard(C, "F"), unit: "F" },
              L2: { theory: L2, standard: toStandard(L2, "H"), unit: "H" },
            },
            reason: `T network (Q1=${Q1.toFixed(2)}, Q2=${Q2.toFixed(2)}): two series inductors with shunt capacitor.`,
          });
        }
      } else {
        // High-pass T: series C1, shunt L, series C2
        const X_C1_needed = Q1 * RL + XL;
        const C1 = (X_C1_needed > 0) ? 1 / (omega * X_C1_needed) : 0;
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
            reason: `High-pass T (Q1=${Q1.toFixed(2)}, Q2=${Q2.toFixed(2)}): series capacitors with shunt inductor.`,
          });
        }
      }
    } catch {
      // Skip
    }
  }

  // No filtering — keep all results, path validation happens in SmithChart

  // Sort results: prioritize based on impedance ratio
  const priority = (name: string): number => {
    if (ratio > 2) {
      if (name.includes("Pi")) return 0;
      if (name.includes("L Section")) return 1;
      if (name.includes("T Network")) return 2;
    } else if (ratio < 0.5) {
      if (name.includes("T Network")) return 0;
      if (name.includes("L Section")) return 1;
      if (name.includes("Pi")) return 2;
    } else {
      if (name.includes("L Section")) return 0;
      if (name.includes("Pi")) return 1;
      if (name.includes("T Network")) return 2;
    }
    return 3;
  };

  results.sort((a, b) => priority(a.network) - priority(b.network));

  if (results.length > 0) {
    const rec = ratio > 2 ? "Pi network recommended for high-impedance loads" :
                ratio < 0.5 ? "T network recommended for low-impedance loads" :
                "L-section recommended for moderate impedance ratio";
    results[0].reason = `${rec}. ${results[0].reason}`;
  }

  return results;
}

/** Simulate the matching path and return final impedance */
function simulatePath(
  result: MatchResult,
  ZLReal: number,
  ZLImag: number,
  Z0: number,
  omega: number
): { r: number; x: number } | null {
  let currR = ZLReal;
  let currX = ZLImag;
  const comps = result.components;
  const isHP = result.network.includes("High-pass") || 
    (comps.C_series && comps.L_shunt) || 
    (comps.L1 && comps.C && comps.L2 && result.reason.includes("High-pass")) ||
    (comps.C1 && comps.L && comps.C2 && result.reason.includes("High-pass"));

  // Build sequence same as SmithChart
  let sequence: { val: number; type: string }[] = [];

  if (result.network.includes("L Section")) {
    if (comps.L_series && comps.C_shunt) {
      sequence = [
        { val: comps.L_series.theory, type: "seriesL" },
        { val: comps.C_shunt.theory, type: "shuntC" },
      ];
    } else if (comps.C_series && comps.L_shunt) {
      sequence = [
        { val: comps.C_series.theory, type: "seriesC" },
        { val: comps.L_shunt.theory, type: "shuntL" },
      ];
    } else if (comps.C_series) {
      sequence = [{ val: comps.C_series.theory, type: "seriesC" }];
    } else if (comps.L_series) {
      sequence = [{ val: comps.L_series.theory, type: "seriesL" }];
    }
  } else if (result.network.includes("Pi")) {
    if (comps.C1 && comps.L && comps.C2) {
      sequence = [
        { val: comps.C1.theory, type: "shuntC" },
        { val: comps.L.theory, type: "seriesL" },
        { val: comps.C2.theory, type: "shuntC" },
      ];
    } else if (comps.L1 && comps.C && comps.L2) {
      sequence = [
        { val: comps.L1.theory, type: "shuntL" },
        { val: comps.C.theory, type: "seriesC" },
        { val: comps.L2.theory, type: "shuntL" },
      ];
    }
  } else if (result.network.includes("T")) {
    if (comps.L1 && comps.C && comps.L2) {
      sequence = [
        { val: comps.L1.theory, type: "seriesL" },
        { val: comps.C.theory, type: "shuntC" },
        { val: comps.L2.theory, type: "seriesL" },
      ];
    } else if (comps.C1 && comps.L && comps.C2) {
      sequence = [
        { val: comps.C1.theory, type: "seriesC" },
        { val: comps.L.theory, type: "shuntL" },
        { val: comps.C2.theory, type: "seriesC" },
      ];
    }
  }

  for (const { val, type } of sequence) {
    if (!val || val <= 0) return null;

    if (type === "seriesL") {
      currX += omega * val;
    } else if (type === "seriesC") {
      currX -= 1 / (omega * val);
    } else {
      // Shunt: convert to admittance
      const den = currR * currR + currX * currX;
      if (den < 1e-12) return null;
      const G = currR / den;
      let B = -currX / den;

      if (type === "shuntC") {
        B += omega * val;
      } else {
        B -= 1 / (omega * val);
      }

      // Convert back to impedance
      const yDen = G * G + B * B;
      if (yDen < 1e-12) return null;
      currR = G / yDen;
      currX = -B / yDen;
    }
  }

  return { r: currR, x: currX };
}
