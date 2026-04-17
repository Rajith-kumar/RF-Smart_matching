import React from "react";
import { Activity, Gauge, Radio, Waves, Target, TrendingDown } from "lucide-react";

interface RfMetricsProps {
  ZLReal: number;
  ZLImag: number;
  Z0: number;
  freqHz: number;
}

/**
 * Computes and displays advanced RF parameters for the load impedance:
 *   • Reflection Coefficient (Γ)  – magnitude, angle, real, imag
 *   • VSWR                         – (1+|Γ|) / (1-|Γ|)
 *   • Return Loss                  – -20·log10|Γ|  (dB)
 *   • Mismatch Loss                – -10·log10(1-|Γ|²)  (dB)
 *   • Q factor (load)              – |X_L| / R_L
 *   • |Z_L|, ∠Z_L (polar form)
 *   • Admittance Y_L = G + jB      (mS)
 *   • Wavelength λ                 – c/f  (mm)
 *   • Electrical length / phase constant
 */
const RfMetrics: React.FC<RfMetricsProps> = ({ ZLReal, ZLImag, Z0, freqHz }) => {
  // Reflection coefficient: Γ = (ZL - Z0) / (ZL + Z0)
  const numR = ZLReal - Z0;
  const numI = ZLImag;
  const denR = ZLReal + Z0;
  const denI = ZLImag;
  const denMag2 = denR * denR + denI * denI;
  const gammaR = (numR * denR + numI * denI) / denMag2;
  const gammaI = (numI * denR - numR * denI) / denMag2;
  const gammaMag = Math.sqrt(gammaR * gammaR + gammaI * gammaI);
  const gammaAngle = (Math.atan2(gammaI, gammaR) * 180) / Math.PI;

  // VSWR
  const vswr = gammaMag >= 1 ? Infinity : (1 + gammaMag) / (1 - gammaMag);

  // Return loss & mismatch loss (dB)
  const returnLoss = gammaMag > 0 ? -20 * Math.log10(gammaMag) : Infinity;
  const mismatchLoss = gammaMag < 1 ? -10 * Math.log10(1 - gammaMag * gammaMag) : Infinity;

  // Polar form of Z_L
  const zMag = Math.sqrt(ZLReal * ZLReal + ZLImag * ZLImag);
  const zAngle = (Math.atan2(ZLImag, ZLReal) * 180) / Math.PI;

  // Q factor of the load
  const qFactor = ZLReal > 0 ? Math.abs(ZLImag) / ZLReal : Infinity;

  // Admittance Y = 1/Z = (R - jX) / (R² + X²) — converted to mS
  const zMag2 = ZLReal * ZLReal + ZLImag * ZLImag;
  const G = zMag2 > 0 ? (ZLReal / zMag2) * 1000 : 0;
  const B = zMag2 > 0 ? (-ZLImag / zMag2) * 1000 : 0;

  // Wavelength (free space) λ = c/f in mm
  const lambda = freqHz > 0 ? (3e8 / freqHz) * 1000 : 0;
  // Phase constant β = 2π/λ  (rad/mm)
  const beta = lambda > 0 ? (2 * Math.PI) / lambda : 0;

  // Power transfer efficiency (1 - |Γ|²) as %
  const powerEff = (1 - gammaMag * gammaMag) * 100;

  const fmt = (n: number, d = 3) =>
    !isFinite(n) ? "∞" : Math.abs(n) >= 1000 || (Math.abs(n) < 0.01 && n !== 0)
      ? n.toExponential(2)
      : n.toFixed(d);

  const metrics = [
    {
      icon: Target,
      label: "Reflection Coeff. (Γ)",
      value: `${fmt(gammaR)} ${gammaI >= 0 ? "+" : "−"} j${fmt(Math.abs(gammaI))}`,
      sub: `|Γ| = ${fmt(gammaMag)}  ∠ ${fmt(gammaAngle, 2)}°`,
      tone: "primary",
    },
    {
      icon: Gauge,
      label: "VSWR",
      value: fmt(vswr, 2),
      sub: vswr <= 1.5 ? "Excellent match" : vswr <= 2 ? "Good match" : vswr <= 3 ? "Acceptable" : "Poor match",
      tone: vswr <= 2 ? "success" : vswr <= 3 ? "primary" : "destructive",
    },
    {
      icon: TrendingDown,
      label: "Return Loss",
      value: `${fmt(returnLoss, 2)} dB`,
      sub: `Mismatch Loss: ${fmt(mismatchLoss, 3)} dB`,
      tone: returnLoss >= 14 ? "success" : "primary",
    },
    {
      icon: Activity,
      label: "Load Q Factor",
      value: fmt(qFactor, 3),
      sub: `Q = |X_L| / R_L`,
      tone: "primary",
    },
    {
      icon: Radio,
      label: "Impedance |Z_L|",
      value: `${fmt(zMag, 2)} Ω`,
      sub: `∠ ${fmt(zAngle, 2)}°  (polar form)`,
      tone: "primary",
    },
    {
      icon: Waves,
      label: "Admittance Y_L",
      value: `${fmt(G, 3)} ${B >= 0 ? "+" : "−"} j${fmt(Math.abs(B), 3)} mS`,
      sub: `G = 1/R_eq, B = susceptance`,
      tone: "primary",
    },
    {
      icon: Waves,
      label: "Wavelength (λ)",
      value: lambda >= 1000 ? `${fmt(lambda / 1000, 3)} m` : `${fmt(lambda, 2)} mm`,
      sub: `β = ${fmt(beta, 5)} rad/mm`,
      tone: "primary",
    },
    {
      icon: Gauge,
      label: "Power Transfer",
      value: `${fmt(powerEff, 2)} %`,
      sub: `η = 1 − |Γ|²`,
      tone: powerEff >= 90 ? "success" : powerEff >= 75 ? "primary" : "destructive",
    },
  ];

  const toneClass = (tone: string) => {
    if (tone === "success") return "border-l-success text-success";
    if (tone === "destructive") return "border-l-destructive text-destructive";
    return "border-l-primary text-primary";
  };

  return (
    <div className="bg-card rounded-2xl p-6 border border-border mb-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold text-card-foreground flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            RF Technical Parameters
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Pre-match analysis of load Z_L referenced to Z₀ = {Z0} Ω
          </p>
        </div>
        <span className="text-[10px] font-extrabold text-primary bg-primary/10 px-2.5 py-1 rounded-md">
          Advanced Metrics
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {metrics.map((m) => {
          const Icon = m.icon;
          return (
            <div
              key={m.label}
              className={`bg-background p-3 rounded-lg border border-border border-l-4 ${toneClass(m.tone)}`}
            >
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-semibold">
                <Icon className="w-3 h-3" />
                {m.label}
              </div>
              <p className="text-sm font-extrabold text-card-foreground my-1.5 break-all">
                {m.value}
              </p>
              <p className="text-[10px] text-muted-foreground">{m.sub}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RfMetrics;
