import React, { useState, useEffect } from "react";
import { Radio, Zap, Activity, Settings, ChevronRight, Layers, Database, Info, User, Mail, TrendingUp } from "lucide-react";
import SmithChart from "@/components/SmithChart";
import CircuitSchematic from "@/components/CircuitSchematic";
import RfMetrics from "@/components/RfMetrics";
import { computeMatch } from "@/lib/matchingEngine";

interface ComponentData {
  theory: number;
  standard: string;
  unit: string;
}

interface MatchResult {
  network: string;
  components: Record<string, ComponentData>;
  reason: string;
}

const teamMembers = [
  { name: "Arjun Mehta", role: "Lead RF Engineer", bio: "Ph.D. in Electromagnetics. Specialized in Filter Synthesis." },
  { name: "Sarah Chen", role: "Frontend Architect", bio: "Expert in real-time data visualization and React UI." },
  { name: "David Miller", role: "Backend Developer", bio: "Algorithm lead for Smith Chart computational logic." },
  { name: "Priya Das", role: "UI/UX Designer", bio: "Focused on technical workflows for hardware engineers." },
  { name: "Kevin V.", role: "QA Engineer", bio: "Hardware validation and impedance accuracy specialist." },
];

const Index = () => {
  const [activeTab, setActiveTab] = useState("home");
  const [ZLReal, setZLReal] = useState(50);
  const [ZLImag, setZLImag] = useState(0);
  const [Z0, setZ0] = useState(50);
  const [mode, setMode] = useState("low_pass");
  const [result, setResult] = useState<MatchResult | null>(null);
  const [allResults, setAllResults] = useState<MatchResult[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [isCalculating, setIsCalculating] = useState(false);
  const [freq, setFreq] = useState("100");
  const [freqUnit, setFreqUnit] = useState("MHz");
  const [band, setBand] = useState("VHF");
  const [viewMode, setViewMode] = useState<"schematic" | "smith">("schematic");

  const getRealHz = () => {
    const value = parseFloat(freq) || 0;
    const multipliers: Record<string, number> = { Hz: 1, KHz: 1e3, MHz: 1e6, GHz: 1e9 };
    return value * multipliers[freqUnit];
  };

  useEffect(() => {
    const realHz = getRealHz();
    if (realHz < 3e6) setBand("MF");
    else if (realHz < 30e6) setBand("HF");
    else if (realHz < 300e6) setBand("VHF");
    else if (realHz < 3e9) setBand("UHF");
    else setBand("SHF");
  }, [freq, freqUnit]);

  const handleMatch = () => {
    setIsCalculating(true);
    const results = computeMatch(ZLReal, ZLImag, Z0, getRealHz(), mode);
    if (results.length > 0) {
      setAllResults(results);
      setSelectedIdx(0);
      setResult(results[0]);
      setViewMode("schematic");
    } else {
      setAllResults([]);
      setResult(null);
    }
    setIsCalculating(false);
  };

  const handleSelectNetwork = (idx: number) => {
    setSelectedIdx(idx);
    setResult(allResults[idx]);
  };

  const renderHome = () => (
    <div className="flex gap-8 p-8 max-w-7xl mx-auto">
      {/* Sidebar */}
      <div className="w-[380px] shrink-0">
        <div className="bg-card rounded-2xl p-6 border border-border sticky top-[86px] max-h-[calc(100vh-100px)] overflow-y-auto">
          <div className="flex items-center gap-2 font-bold text-card-foreground mb-5">
            <Settings className="w-4 h-4 text-primary" />
            Parameter Config
          </div>

          <div className="mb-5">
            <label className="text-xs font-bold text-muted-foreground mb-2 block">Load Impedance (Z_L)</label>
            <div className="flex gap-2 items-center">
              <input
                type="number"
                value={ZLReal}
                onChange={(e) => setZLReal(parseFloat(e.target.value) || 0)}
                className="w-full p-3 rounded-lg border border-input bg-background text-foreground"
              />
              <span className="text-muted-foreground font-bold">+ j</span>
              <input
                type="number"
                value={ZLImag}
                onChange={(e) => setZLImag(parseFloat(e.target.value) || 0)}
                className="w-full p-3 rounded-lg border border-input bg-background text-foreground"
              />
            </div>
          </div>

          <div className="mb-5">
            <label className="text-xs font-bold text-muted-foreground mb-2 block">System Z0 (Ω)</label>
            <input
              type="number"
              value={Z0}
              onChange={(e) => setZ0(parseFloat(e.target.value) || 50)}
              className="w-full p-3 rounded-lg border border-input bg-background text-foreground"
            />
          </div>

          <div className="mb-5">
            <label className="text-xs font-bold text-muted-foreground mb-2 block">Operating Frequency</label>
            <div className="flex">
              <input
                type="number"
                value={freq}
                onChange={(e) => setFreq(e.target.value)}
                className="flex-1 p-3 rounded-l-lg border border-input bg-background text-foreground border-r-0"
              />
              <select
                value={freqUnit}
                onChange={(e) => setFreqUnit(e.target.value)}
                className="w-[85px] p-3 rounded-r-lg border border-input bg-background text-foreground"
              >
                <option>Hz</option>
                <option>KHz</option>
                <option>MHz</option>
                <option>GHz</option>
              </select>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1.5">
              Detected Band: <span className="font-bold text-primary">{band}</span>
            </p>
          </div>

          <div className="mb-5">
            <label className="text-xs font-bold text-muted-foreground mb-2 block">Design Preference</label>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value)}
              className="w-full p-3 rounded-lg border border-input bg-background text-foreground"
            >
              <option value="low_pass">Low-Pass Design (Harmonic Rejection)</option>
              <option value="high_pass">High-Pass Design (DC Blocking)</option>
            </select>
          </div>

          <button
            onClick={handleMatch}
            disabled={isCalculating}
            className="w-full p-4 bg-foreground text-background rounded-xl font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            <Zap className="w-4 h-4" />
            {isCalculating ? "Calculating..." : "Compute Ideal Match"}
          </button>
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 min-w-0">
        {!result ? (
          <div className="h-[300px] flex flex-col items-center justify-center bg-card rounded-2xl border-2 border-dashed border-border text-muted-foreground">
            <Activity className="w-8 h-8 mb-3 opacity-50" />
            <p>Enter parameters to generate RF topology</p>
          </div>
        ) : (
          <>
            {/* Network selection tabs */}
            {allResults.length > 1 && (
              <div className="flex gap-2 mb-4">
                {allResults.map((r, i) => (
                  <button
                    key={r.network}
                    onClick={() => handleSelectNetwork(i)}
                    className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                      i === selectedIdx
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    {r.network}
                    {i === 0 && <span className="ml-1.5 text-[9px] opacity-75">★ Recommended</span>}
                  </button>
                ))}
              </div>
            )}

            <RfMetrics ZLReal={ZLReal} ZLImag={ZLImag} Z0={Z0} freqHz={getRealHz()} />

            <div className="bg-card rounded-2xl p-6 border border-border mb-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-[10px] font-extrabold text-primary bg-primary/10 px-2.5 py-1 rounded-md">
                      {selectedIdx === 0 ? "Recommended" : "Alternative"}
                    </span>
                    <span className="text-[10px] font-extrabold text-success bg-success/10 px-2.5 py-1 rounded-md">
                      {mode === "low_pass" ? "Low Pass" : "High Pass"}
                    </span>
                  </div>
                  <h2 className="text-2xl font-bold text-card-foreground">{result.network}</h2>
                </div>
                <div className="flex bg-muted p-1 rounded-lg">
                  <button
                    onClick={() => setViewMode("schematic")}
                    className={`px-4 py-2 rounded-md text-xs font-bold flex items-center gap-1.5 transition-all ${
                      viewMode === "schematic"
                        ? "bg-card text-primary shadow-sm"
                        : "text-muted-foreground"
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5" /> Schematic
                  </button>
                  <button
                    onClick={() => setViewMode("smith")}
                    className={`px-4 py-2 rounded-md text-xs font-bold flex items-center gap-1.5 transition-all ${
                      viewMode === "smith"
                        ? "bg-card text-primary shadow-sm"
                        : "text-muted-foreground"
                    }`}
                  >
                    <TrendingUp className="w-3.5 h-3.5" /> Smith Chart
                  </button>
                </div>
              </div>

              {viewMode === "schematic" ? (
                <CircuitSchematic result={result} mode={mode} />
              ) : (
                <SmithChart
                  freq={freq}
                  freqUnit={freqUnit}
                  result={result}
                  ZLReal={ZLReal}
                  ZLImag={ZLImag}
                  Z0={Z0}
                  mode={mode}
                />
              )}

              <div className="flex p-3.5 bg-primary/5 rounded-lg text-primary text-[13px] mt-4 items-start gap-2">
                <Info className="w-4 h-4 mt-0.5 shrink-0" />
                {result.reason}
              </div>
            </div>

            <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-5">
              {Object.entries(result.components).map(([name, data]) => (
                <div
                  key={name}
                  className="bg-card p-6 rounded-2xl border border-border border-l-4 border-l-primary"
                >
                  <div className="flex items-center gap-1.5 text-muted-foreground text-[13px]">
                    <Database className="w-3.5 h-3.5" /> {name}
                  </div>
                  <p className="text-xl font-extrabold text-card-foreground my-3">
                    {data.theory.toExponential(2)} {data.unit}
                  </p>
                  <span className="text-xs text-success font-bold bg-success/10 px-2 py-1 rounded">
                    Use Standard: {data.standard}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );

  const renderAbout = () => (
    <div className="max-w-5xl mx-auto p-8">
      <h1 className="text-3xl font-bold text-foreground mb-2">The SmartMatch Engineering Team</h1>
      <p className="text-muted-foreground mb-8">Pioneering automated impedance matching for RF systems.</p>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-8">
        {teamMembers.map((m, i) => (
          <div key={i} className="bg-card p-8 rounded-2xl text-center border border-border">
            <div className="w-[60px] h-[60px] rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <User className="w-6 h-6 text-primary" />
            </div>
            <h3 className="font-bold text-card-foreground">{m.name}</h3>
            <p className="text-xs text-primary font-bold mt-1">{m.role}</p>
            <p className="text-xs text-muted-foreground mt-2">{m.bio}</p>
          </div>
        ))}
      </div>
    </div>
  );

  const renderContact = () => (
    <div className="max-w-xl mx-auto p-8">
      <div className="bg-card p-8 rounded-2xl border border-border">
        <h2 className="text-xl font-bold text-card-foreground flex items-center gap-2 mb-6">
          <Mail className="w-5 h-5 text-primary" /> Contact Technical Support
        </h2>
        <label className="text-xs font-bold text-muted-foreground mb-2 block">Corporate Email</label>
        <input placeholder="@company.com" className="w-full p-3 rounded-lg border border-input bg-background text-foreground mb-4" />
        <label className="text-xs font-bold text-muted-foreground mb-2 block">Issue Category</label>
        <select className="w-full p-3 rounded-lg border border-input bg-background text-foreground mb-4">
          <option>Algorithm Accuracy</option>
          <option>UI/UX Bug</option>
        </select>
        <label className="text-xs font-bold text-muted-foreground mb-2 block">Technical Details</label>
        <textarea className="w-full p-3 rounded-lg border border-input bg-background text-foreground mb-4 h-24 resize-none" />
        <button className="w-full p-4 bg-foreground text-background rounded-xl font-bold hover:opacity-90 transition-opacity">
          Submit Query
        </button>
      </div>
    </div>
  );

  return (
    <div className="bg-background min-h-screen font-sans">
      {/* Navbar */}
      <nav className="flex justify-between items-center px-10 h-[70px] bg-card border-b border-border sticky top-0 z-50">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveTab("home")}>
          <div className="bg-primary p-2 rounded-lg flex">
            <Radio className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="font-extrabold text-xl text-card-foreground">SmartMatch RF Pro</span>
        </div>
        <div className="flex items-center gap-6 font-semibold text-sm">
          {(["home", "about", "contact"] as const).map((tab) => (
            <span
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`cursor-pointer capitalize transition-colors ${
                activeTab === tab
                  ? "text-primary border-b-2 border-primary pb-1"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab === "home" ? "Home" : tab === "about" ? "About Us" : "Contact"}
            </span>
          ))}
          <span className="flex items-center gap-1.5 text-[11px] text-success font-bold bg-success/10 px-3.5 py-1.5 rounded-full">
            <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
            System Active
          </span>
        </div>
      </nav>

      {activeTab === "home" && renderHome()}
      {activeTab === "about" && renderAbout()}
      {activeTab === "contact" && renderContact()}
    </div>
  );
};

export default Index;
