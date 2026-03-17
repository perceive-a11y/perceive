import { useState } from "react";

const COLORS = {
  bg: "#0a0e17",
  bgCard: "#111827",
  bgHover: "#1a2233",
  border: "#1e293b",
  borderActive: "#3b82f6",
  textPrimary: "#e2e8f0",
  textSecondary: "#94a3b8",
  textMuted: "#64748b",
  roots: "#b45309",
  rootsBg: "#451a03",
  rootsBorder: "#92400e",
  trunk: "#059669",
  trunkBg: "#022c22",
  trunkBorder: "#047857",
  branches: "#3b82f6",
  branchesBg: "#0c1929",
  branchesBorder: "#1d4ed8",
  bindings: "#8b5cf6",
  bindingsBg: "#1e1145",
  bindingsBorder: "#6d28d9",
  accent: "#f59e0b",
  tag: "#1e293b",
};

const layers = [
  {
    id: "roots",
    title: "Roots — Rust Crates",
    subtitle: "Foundational libraries. Zero dependencies on any product. Publishable to crates.io.",
    color: COLORS.roots,
    bg: COLORS.rootsBg,
    border: COLORS.rootsBorder,
    icon: "⛏",
    items: [
      {
        name: "a11y-color",
        desc: "WCAG 2.x luminance contrast, APCA/Lc scoring, OKLCH perceptual transforms, sRGB↔linear conversion",
        usedBy: ["Unity Toolkit", "Unreal Toolkit", "Shopify Auditor", "VPAT Copilot"],
      },
      {
        name: "a11y-cvd",
        desc: "Colorblind simulation matrices (Brettel/Viénot for protanopia, deuteranopia, tritanopia, achromatopsia)",
        usedBy: ["Unity Toolkit", "Unreal Toolkit"],
      },
      {
        name: "a11y-rules",
        desc: "WCAG 2.2 success criteria catalog with machine-readable test procedures, severity mapping, and conformance level logic",
        usedBy: ["VPAT Copilot", "Shopify Auditor", "JetBrains Scanner", "Unity Toolkit"],
      },
      {
        name: "a11y-report",
        desc: "Structured report model: findings → VPAT 2.5 Word doc, OpenACR YAML, PDF compliance reports, EAA statements",
        usedBy: ["VPAT Copilot", "Shopify Auditor", "JetBrains Scanner"],
      },
      {
        name: "pdf-a11y",
        desc: "PDF structure tree parser, tag remediation, PDF/UA validation, reading order analysis",
        usedBy: ["PDF 508 Remediation", "VPAT Copilot"],
      },
      {
        name: "local-infer",
        desc: "ONNX Runtime wrapper for local AI: image captioning (Florence-2), text generation, embeddings. No cloud dependency.",
        usedBy: ["PDF 508 Remediation", "Shopify Auditor", "VPAT Copilot", "Pastoral App"],
      },
    ],
  },
  {
    id: "bindings",
    title: "Bindings — Cross-Platform FFI",
    subtitle: "One Rust core → every target platform. Build once, bind everywhere.",
    color: COLORS.bindings,
    bg: COLORS.bindingsBg,
    border: COLORS.bindingsBorder,
    icon: "🔗",
    items: [
      {
        name: "WASM (wasm-pack)",
        desc: "Browser, Shopify theme scanner. Near-native perf for color math in the browser.",
        usedBy: ["Shopify Auditor", "VPAT Copilot (web UI)"],
      },
      {
        name: "Python (PyO3)",
        desc: "CLI tools, backend services, AI/ML pipelines. First-class Rust ↔ Python interop.",
        usedBy: ["VPAT Copilot", "PDF 508 Remediation", "Pastoral App"],
      },
      {
        name: "C# (csbindgen)",
        desc: "Unity native plugin via DllImport. Auto-generated bindings from Rust extern \"C\" functions.",
        usedBy: ["Unity Toolkit"],
      },
      {
        name: "C++ (cbindgen)",
        desc: "Unreal Engine plugin via extern \"C\" → C++ wrapper. Same core, different engine.",
        usedBy: ["Unreal Toolkit"],
      },
      {
        name: "TypeScript (napi-rs)",
        desc: "Node.js native modules for server-side scanning. Shopify app backend, CLI distribution.",
        usedBy: ["Shopify Auditor", "JetBrains Scanner", "VPAT Copilot"],
      },
    ],
  },
  {
    id: "trunk",
    title: "Trunk — Shared Services",
    subtitle: "Composed from root crates. Orchestration logic shared across products.",
    color: COLORS.trunk,
    bg: COLORS.trunkBg,
    border: COLORS.trunkBorder,
    icon: "🌿",
    items: [
      {
        name: "WCAG Scanner Service",
        desc: "Headless browser (Playwright) + axe-core + custom a11y-rules checks → structured findings with WCAG criterion mapping",
        usedBy: ["VPAT Copilot", "Shopify Auditor"],
      },
      {
        name: "AI Remarks Engine",
        desc: "Takes scan findings → generates human-readable VPAT conformance remarks, fix suggestions, and compliance language via local LLM",
        usedBy: ["VPAT Copilot", "Shopify Auditor", "JetBrains Scanner"],
      },
      {
        name: "Color Analysis Pipeline",
        desc: "Input brand colors → full accessible palette (OKLCH) + contrast matrix + CVD simulation previews. Shared by game engine tools.",
        usedBy: ["Unity Toolkit", "Unreal Toolkit"],
      },
      {
        name: "Document Generator",
        desc: "Findings + metadata → VPAT 2.5 .docx, OpenACR .yaml, PDF report, EAA accessibility statement. Template-driven, multi-format.",
        usedBy: ["VPAT Copilot", "Shopify Auditor", "JetBrains Scanner"],
      },
      {
        name: "Alt Text Generator",
        desc: "Image → contextual accessibility description using local Florence-2/Gemma. Purpose-aware (decorative vs. informative vs. functional).",
        usedBy: ["PDF 508 Remediation", "Shopify Auditor", "VPAT Copilot"],
      },
    ],
  },
  {
    id: "branches",
    title: "Branches — Products",
    subtitle: "Each product is a thin UI + integration layer on top of shared trunk/roots.",
    color: COLORS.branches,
    bg: COLORS.branchesBg,
    border: COLORS.branchesBorder,
    icon: "🌳",
    items: [
      {
        name: "Shopify Accessibility Auditor",
        desc: "Scanner Service + AI Remarks + Report Gen → Shopify app. $19–39/mo. 0% commission <$1M. Fastest to revenue.",
        usedBy: [],
        roots: ["a11y-color", "a11y-rules", "a11y-report", "local-infer"],
        effort: "2–3 weeks",
        revenue: "$1–3K/mo",
        priority: "★★★",
      },
      {
        name: "VPAT Copilot",
        desc: "Scanner + AI Remarks + Document Gen + Rules Engine → web app. $199–399/mo. The flagship product.",
        usedBy: [],
        roots: ["a11y-color", "a11y-rules", "a11y-report", "local-infer"],
        effort: "4–6 weeks",
        revenue: "$2–5K/mo",
        priority: "★★★",
      },
      {
        name: "Unity Accessibility Toolkit",
        desc: "CVD shaders + WCAG checker + accessible UI components → Asset Store. $59 one-time. Zero competition.",
        usedBy: [],
        roots: ["a11y-color", "a11y-cvd", "a11y-rules"],
        effort: "2–3 weeks",
        revenue: "$500–1.5K/mo",
        priority: "★★☆",
      },
      {
        name: "Unreal Accessibility Toolkit",
        desc: "Same core as Unity, C++ bindings, Blueprint-friendly API → FAB. $59. 88/12 split.",
        usedBy: [],
        roots: ["a11y-color", "a11y-cvd", "a11y-rules"],
        effort: "2–3 weeks",
        revenue: "$500–1K/mo",
        priority: "★★☆",
      },
      {
        name: "PDF 508 Remediation",
        desc: "PDF parser + local AI alt text + tag remediation → self-hosted tool. $0.50–2/page. Federal niche.",
        usedBy: [],
        roots: ["pdf-a11y", "local-infer", "a11y-rules", "a11y-report"],
        effort: "6–8 weeks",
        revenue: "$1–3K/mo",
        priority: "★★☆",
      },
      {
        name: "JetBrains FedDev Scanner",
        desc: "Code-level WCAG + NIST 800-53 checks → IDE plugin. $49–149/yr. Blue ocean.",
        usedBy: [],
        roots: ["a11y-rules", "a11y-report"],
        effort: "3 weeks",
        revenue: "$500–1.5K/mo",
        priority: "★☆☆",
      },
      {
        name: "Pastoral Wellness App",
        desc: "Local AI journaling + burnout scoring + Scripture prompts → PWA. $5–15/mo. Values-aligned.",
        usedBy: [],
        roots: ["local-infer"],
        effort: "4–6 weeks",
        revenue: "$500–2K/mo",
        priority: "★☆☆",
      },
    ],
  },
];

const CodeReuse = () => {
  const matrix = {};
  const allProducts = layers[3].items.map((i) => i.name);
  const allRoots = layers[0].items.map((i) => i.name);

  allRoots.forEach((root) => {
    matrix[root] = {};
    const rootItem = layers[0].items.find((i) => i.name === root);
    allProducts.forEach((prod) => {
      matrix[root][prod] = rootItem.usedBy.some((u) =>
        prod.toLowerCase().includes(u.toLowerCase().split(" ")[0])
      );
    });
  });

  // Manual corrections for accuracy
  const manualMap = {
    "a11y-color": ["Shopify Accessibility Auditor", "VPAT Copilot", "Unity Accessibility Toolkit", "Unreal Accessibility Toolkit"],
    "a11y-cvd": ["Unity Accessibility Toolkit", "Unreal Accessibility Toolkit"],
    "a11y-rules": ["VPAT Copilot", "Shopify Accessibility Auditor", "JetBrains FedDev Scanner", "Unity Accessibility Toolkit", "Unreal Accessibility Toolkit", "PDF 508 Remediation"],
    "a11y-report": ["VPAT Copilot", "Shopify Accessibility Auditor", "JetBrains FedDev Scanner", "PDF 508 Remediation"],
    "pdf-a11y": ["PDF 508 Remediation", "VPAT Copilot"],
    "local-infer": ["PDF 508 Remediation", "Shopify Accessibility Auditor", "VPAT Copilot", "Pastoral Wellness App"],
  };

  return (
    <div style={{ overflowX: "auto", marginTop: 16 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
        <thead>
          <tr>
            <th style={{ padding: "6px 8px", textAlign: "left", color: COLORS.textMuted, borderBottom: `1px solid ${COLORS.border}`, position: "sticky", left: 0, background: COLORS.bg, zIndex: 1, minWidth: 90 }}>
              Crate ↓ / Product →
            </th>
            {allProducts.map((p) => (
              <th key={p} style={{ padding: "6px 4px", textAlign: "center", color: COLORS.textMuted, borderBottom: `1px solid ${COLORS.border}`, fontSize: 10, maxWidth: 80, lineHeight: 1.2 }}>
                {p.replace(" Accessibility", "")}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {allRoots.map((root) => (
            <tr key={root}>
              <td style={{ padding: "5px 8px", color: COLORS.roots, fontFamily: "monospace", fontSize: 11, borderBottom: `1px solid ${COLORS.border}`, position: "sticky", left: 0, background: COLORS.bg, zIndex: 1 }}>
                {root}
              </td>
              {allProducts.map((prod) => {
                const used = manualMap[root]?.includes(prod);
                return (
                  <td key={prod} style={{ padding: "5px 4px", textAlign: "center", borderBottom: `1px solid ${COLORS.border}` }}>
                    {used ? (
                      <span style={{ color: "#22c55e", fontSize: 14 }}>●</span>
                    ) : (
                      <span style={{ color: COLORS.border, fontSize: 14 }}>·</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const LayerCard = ({ layer, expanded, onToggle }) => {
  return (
    <div
      style={{
        border: `1px solid ${layer.border}`,
        borderRadius: 8,
        marginBottom: 12,
        background: layer.bg,
        overflow: "hidden",
        transition: "all 0.2s",
      }}
    >
      <div
        onClick={onToggle}
        style={{
          padding: "14px 18px",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 12,
          borderBottom: expanded ? `1px solid ${layer.border}` : "none",
        }}
      >
        <span style={{ fontSize: 20 }}>{layer.icon}</span>
        <div style={{ flex: 1 }}>
          <div style={{ color: layer.color, fontWeight: 700, fontSize: 15, letterSpacing: "-0.01em" }}>
            {layer.title}
          </div>
          <div style={{ color: COLORS.textMuted, fontSize: 12, marginTop: 2, lineHeight: 1.4 }}>
            {layer.subtitle}
          </div>
        </div>
        <span style={{ color: COLORS.textMuted, fontSize: 18, transform: expanded ? "rotate(90deg)" : "rotate(0)", transition: "transform 0.2s" }}>
          ›
        </span>
      </div>
      {expanded && (
        <div style={{ padding: "8px 18px 14px" }}>
          {layer.items.map((item, i) => (
            <div
              key={i}
              style={{
                padding: "10px 12px",
                marginTop: 6,
                background: COLORS.bgCard,
                borderRadius: 6,
                border: `1px solid ${COLORS.border}`,
              }}
            >
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                <code style={{ color: layer.color, fontSize: 13, fontWeight: 600 }}>{item.name}</code>
                {item.effort && (
                  <span style={{ fontSize: 10, color: COLORS.textMuted, background: COLORS.tag, padding: "1px 6px", borderRadius: 3 }}>
                    {item.effort}
                  </span>
                )}
                {item.revenue && (
                  <span style={{ fontSize: 10, color: COLORS.accent, background: "rgba(245,158,11,0.1)", padding: "1px 6px", borderRadius: 3 }}>
                    {item.revenue}
                  </span>
                )}
                {item.priority && (
                  <span style={{ fontSize: 10, color: "#fbbf24" }}>{item.priority}</span>
                )}
              </div>
              <div style={{ color: COLORS.textSecondary, fontSize: 12, marginTop: 4, lineHeight: 1.5 }}>
                {item.desc}
              </div>
              {item.usedBy && item.usedBy.length > 0 && (
                <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {item.usedBy.map((u, j) => (
                    <span
                      key={j}
                      style={{
                        fontSize: 9,
                        color: COLORS.branches,
                        background: "rgba(59,130,246,0.1)",
                        padding: "1px 5px",
                        borderRadius: 3,
                        border: `1px solid rgba(59,130,246,0.2)`,
                      }}
                    >
                      {u}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const BuildOrder = () => {
  const phases = [
    {
      phase: "Phase 0",
      time: "Week 1–2",
      title: "Plant the roots",
      items: [
        "Publish a11y-color + a11y-cvd as open-source Rust crates",
        "WASM build target working (wasm-pack)",
        "This is your calling card — stars, credibility, open-source cred",
      ],
      unlocks: "Unity/Unreal color tools, Shopify auditor",
    },
    {
      phase: "Phase 1",
      time: "Week 2–4",
      title: "First revenue: Shopify",
      items: [
        "Shopify auditor MVP using a11y-rules + headless scanner",
        "Earns revenue while you build the bigger products",
      ],
      unlocks: "$1–3K/mo within 2–4 months",
    },
    {
      phase: "Phase 2",
      time: "Week 4–8",
      title: "Game engine plugins",
      items: [
        "Unity toolkit: a11y-cvd → GPU shader, a11y-rules → editor checker",
        "Unreal port: same crates, C++ bindings via cbindgen",
        "Free colorblind debug tools → paid full toolkits",
      ],
      unlocks: "$500–1.5K/mo, marketplace credibility",
    },
    {
      phase: "Phase 3",
      time: "Week 8–14",
      title: "Flagship: VPAT Copilot",
      items: [
        "Reuses Scanner Service, AI Remarks, Document Generator, Rules Engine",
        "By now you've battle-tested every root crate across 4 products",
        "Validate with 5 federal contacts before building UI",
      ],
      unlocks: "$2–5K/mo, professional authority",
    },
    {
      phase: "Phase 4",
      time: "Ongoing",
      title: "Expand branches",
      items: [
        "PDF 508 Remediation (pdf-a11y + local-infer)",
        "JetBrains FedDev Scanner (a11y-rules + a11y-report)",
        "Pastoral Wellness App (local-infer + values alignment)",
      ],
      unlocks: "Portfolio → brand → consulting leverage",
    },
  ];

  return (
    <div style={{ marginTop: 16 }}>
      {phases.map((p, i) => (
        <div key={i} style={{ display: "flex", gap: 12, marginBottom: 12 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 20 }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: i <= 1 ? COLORS.accent : COLORS.textMuted, marginTop: 6 }} />
            {i < phases.length - 1 && <div style={{ width: 1, flex: 1, background: COLORS.border, marginTop: 4 }} />}
          </div>
          <div style={{ flex: 1, paddingBottom: 4 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
              <span style={{ color: COLORS.accent, fontWeight: 700, fontSize: 12 }}>{p.phase}</span>
              <span style={{ color: COLORS.textMuted, fontSize: 11 }}>{p.time}</span>
            </div>
            <div style={{ color: COLORS.textPrimary, fontWeight: 600, fontSize: 14, marginTop: 2 }}>{p.title}</div>
            <div style={{ marginTop: 6 }}>
              {p.items.map((item, j) => (
                <div key={j} style={{ color: COLORS.textSecondary, fontSize: 12, lineHeight: 1.6, paddingLeft: 12, position: "relative" }}>
                  <span style={{ position: "absolute", left: 0, color: COLORS.textMuted }}>·</span>
                  {item}
                </div>
              ))}
            </div>
            <div style={{ marginTop: 6, fontSize: 11, color: COLORS.trunk }}>
              → {p.unlocks}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default function PlatformTree() {
  const [expandedLayers, setExpandedLayers] = useState({ roots: true, bindings: false, trunk: false, branches: true });
  const [view, setView] = useState("tree");

  const toggleLayer = (id) => {
    setExpandedLayers((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div style={{ background: COLORS.bg, color: COLORS.textPrimary, minHeight: "100vh", fontFamily: "'IBM Plex Sans', -apple-system, sans-serif", padding: "24px 20px" }}>
      <div style={{ maxWidth: 740, margin: "0 auto" }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: COLORS.textPrimary, letterSpacing: "-0.02em", margin: 0, lineHeight: 1.2 }}>
            The Accessibility Platform
          </h1>
          <p style={{ color: COLORS.textMuted, fontSize: 13, marginTop: 6, lineHeight: 1.5 }}>
            6 Rust crates → 5 bindings → 5 shared services → 7 products.{" "}
            <span style={{ color: COLORS.accent }}>Every product shares roots.</span>
          </p>
        </div>

        <div style={{ display: "flex", gap: 4, marginBottom: 16, background: COLORS.bgCard, borderRadius: 6, padding: 3, border: `1px solid ${COLORS.border}` }}>
          {[
            { id: "tree", label: "Architecture" },
            { id: "matrix", label: "Reuse Matrix" },
            { id: "build", label: "Build Order" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setView(tab.id)}
              style={{
                flex: 1,
                padding: "7px 12px",
                background: view === tab.id ? COLORS.border : "transparent",
                color: view === tab.id ? COLORS.textPrimary : COLORS.textMuted,
                border: "none",
                borderRadius: 4,
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 600,
                transition: "all 0.15s",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {view === "tree" && (
          <>
            <div style={{ marginBottom: 16, padding: "10px 14px", background: COLORS.bgCard, borderRadius: 6, border: `1px solid ${COLORS.border}` }}>
              <div style={{ fontSize: 11, color: COLORS.textMuted, lineHeight: 1.6 }}>
                <span style={{ color: COLORS.roots }}>●</span> Roots = pure Rust crates, no product logic{" "}
                <span style={{ color: COLORS.bindings, marginLeft: 8 }}>●</span> Bindings = FFI to every platform{" "}
                <span style={{ color: COLORS.trunk, marginLeft: 8 }}>●</span> Trunk = composed services{" "}
                <span style={{ color: COLORS.branches, marginLeft: 8 }}>●</span> Branches = shipped products
              </div>
            </div>
            {layers.map((layer) => (
              <LayerCard
                key={layer.id}
                layer={layer}
                expanded={expandedLayers[layer.id]}
                onToggle={() => toggleLayer(layer.id)}
              />
            ))}

            <div style={{ marginTop: 20, padding: "14px 18px", background: COLORS.bgCard, borderRadius: 8, border: `1px solid ${COLORS.border}` }}>
              <div style={{ color: COLORS.accent, fontWeight: 700, fontSize: 13, marginBottom: 8 }}>The leverage math</div>
              <div style={{ color: COLORS.textSecondary, fontSize: 12, lineHeight: 1.7 }}>
                <strong style={{ color: COLORS.textPrimary }}>a11y-color</strong> is written once and used in 4 products across 5 platforms (WASM, Python, C#, C++, Node).
                <br />
                <strong style={{ color: COLORS.textPrimary }}>a11y-rules</strong> is written once and drives VPAT generation, Shopify scanning, game engine checking, and IDE analysis.
                <br />
                <strong style={{ color: COLORS.textPrimary }}>local-infer</strong> is written once and powers alt text in PDFs, fix suggestions in Shopify, VPAT remarks, and pastoral journaling.
                <br /><br />
                Building product #1 takes 3 weeks. Products #2–4 take 1–2 weeks each because the core is done.
                That's the whole strategy: <strong style={{ color: COLORS.accent }}>front-load the roots, harvest across branches.</strong>
              </div>
            </div>
          </>
        )}

        {view === "matrix" && (
          <div style={{ background: COLORS.bgCard, borderRadius: 8, border: `1px solid ${COLORS.border}`, padding: "14px 12px" }}>
            <div style={{ color: COLORS.textPrimary, fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Code Reuse Matrix</div>
            <div style={{ color: COLORS.textMuted, fontSize: 11, marginBottom: 12 }}>
              Every <span style={{ color: "#22c55e" }}>●</span> = shared Rust crate reused without modification
            </div>
            <CodeReuse />
            <div style={{ marginTop: 16, padding: "10px 12px", background: COLORS.bg, borderRadius: 6 }}>
              <div style={{ fontSize: 12, color: COLORS.textSecondary, lineHeight: 1.6 }}>
                <strong style={{ color: COLORS.accent }}>Key insight:</strong> The Shopify auditor and VPAT Copilot share 4 of 6 crates. Building one gives you ~70% of the other for free. The game engine toolkits share the color science core — build once, deploy to 2 marketplaces. Only the Pastoral App is relatively standalone (shares just local-infer).
              </div>
            </div>
          </div>
        )}

        {view === "build" && (
          <div style={{ background: COLORS.bgCard, borderRadius: 8, border: `1px solid ${COLORS.border}`, padding: "14px 18px" }}>
            <div style={{ color: COLORS.textPrimary, fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Recommended Build Order</div>
            <div style={{ color: COLORS.textMuted, fontSize: 11, marginBottom: 8 }}>
              Sequence optimized for: crate reuse → earliest revenue → credibility building
            </div>
            <BuildOrder />
            <div style={{ marginTop: 16, padding: "10px 12px", background: COLORS.bg, borderRadius: 6 }}>
              <div style={{ fontSize: 12, color: COLORS.textSecondary, lineHeight: 1.6 }}>
                <strong style={{ color: COLORS.accent }}>Total timeline to 5 revenue streams:</strong> ~14 weeks at 20hr/week.
                By week 14, the root crates have been battle-tested across Shopify, Unity, Unreal, and a web app.
                Each new branch costs less to build because the roots are proven and the bindings are established.
                The brand becomes "the accessibility tools developer" across every major platform.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
