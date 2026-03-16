# The best plugin ideas for a solo developer targeting $1K/month

**Accessibility compliance tools represent the single highest-opportunity category across every marketplace researched** — Unity, Unreal/FAB, Shopify, Figma, and JetBrains all have enormous, well-documented gaps that map precisely to this developer's WCAG, GPU/shader, and AI/ML skills. The European Accessibility Act (EAA), enforceable since June 2025 with fines up to **€100,000 per violation**, has created urgent demand that existing tools fail to meet. Combined with the CVAA for games, ADA lawsuits (8,800+ filed in 2024), and Section 508 for federal work, regulatory pressure is the rising tide that lifts all accessibility tools. Below are the seven most promising plugin ideas, ranked by evidence of demand, skill fit, and realistic revenue potential, followed by the strategic playbook proven by successful solo plugin developers.

---

## 1. Shopify AI accessibility auditor: the strongest overall opportunity

**The gap:** Every accessibility app on Shopify's App Store under $100/month is an overlay widget — JavaScript injected after page load that screen readers can't use. **22.6% of all ADA website lawsuits in H1 2025 targeted sites with overlay widgets installed.** The FTC reached a $1M settlement with accessiBe in 2025 over misleading compliance claims. The only tool doing real source-code analysis is TestParty at $1,000–$5,000/month — priced exclusively for enterprise. There is no affordable ($20–$50/month) source-code remediation tool for Shopify merchants.

**Evidence of demand:** The EAA is already in effect across 27 EU member states, requiring WCAG 2.1 AA conformance for any business selling to EU consumers. One Shopify user of the overlay app Accessibly reported: *"Our website is based out of CA, we got sued from a blind person and realized this app didn't protect us."* The competitive landscape contains 15+ overlay widgets all doing the same ineffective thing, while the actual problem — fixing theme HTML, CSS, and Liquid code — remains unsolved at accessible price points.

**What to build (MVP in 2–3 weeks):** An AI-powered scanner that analyzes Shopify theme code via headless browser, identifies WCAG 2.2 AA violations at the source, and generates specific code fix recommendations. Features: dashboard showing violations by severity, AI-generated fix suggestions per violation, exportable compliance report, and EAA accessibility statement generator in multiple languages. V1.1 adds ongoing monitoring and WCAG-compliant alt text generation focused on screen reader usability (not SEO keywords like existing tools).

**Pricing:** Free (5-page audit), $19/month (full site audit + fix suggestions), $39/month (auto-fix generation + monitoring + EAA statement). **Shopify takes 0% commission on the first $1M in revenue** — you keep ~97% after payment processing.

**Revenue path:** 100 merchants at $29 average = **$2,900/month**. Erikas Mališauskas reached $1,000 MRR in 4 months on Shopify with a utility app. The urgency created by EAA enforcement means merchants are actively searching for solutions right now.

**Why this developer:** Python + AI/ML builds the scanning engine. TypeScript builds the Shopify app. WCAG expertise is the core moat — most overlay app developers market "compliance" without understanding the standards. This combination appears unmatched on the Shopify App Store.

---

## 2. Unity accessibility toolkit: zero modern competition in a regulated space

**The gap:** The only dedicated accessibility plugin on the Unity Asset Store — UAP by MetalPop Games — **hasn't been updated since April 2021**. It supports only UGUI, only Unity 2020.1, and has just 13 reviews. Unity's own support page states: *"Unity lacks comprehensive built-in accessibility features for visually impaired users."* Apple released a Unity accessibility plugin at WWDC 2022, but it's iOS/VoiceOver-only. The CVAA legally requires multiplayer games to have accessibility features. Section 508 applies to any game distributed to schools, military, or government.

**Evidence of demand:** On AppleVis (blind user community), a developer reported: *"We abandoned Unity as the development platform because VoiceOver support was subpar."* The Unity forums have a dedicated Accessibility & Inclusion thread. A developer on Unity discussions described the pain: *"JsonUtility breaking with complex data (again!), hours debugging corrupted saves, zero built-in tools to actually see what's happening"* — and that's just for save systems. Accessibility tooling is even more barren.

**What to build (MVP in 2–3 weeks):** A WCAG compliance checker scanning UI for contrast ratios, touch target sizes, and font sizes. A GPU-accelerated colorblind simulation post-processing shader showing protanopia/deuteranopia/tritanopia views in real-time in the editor. Basic accessible UI components with keyboard navigation and focus management. A settings system for one-click high contrast mode, text scaling, and reduce motion toggles.

**Pricing:** $49–$79 (Easy Save sells for $59 with 1,035 reviews and 13,018 favorites, proving tools in this range sell well). At $59 after Unity's 30% cut, you net **$41.30 per sale — need ~24 sales/month** for $1K.

**Why this developer:** WCAG expertise is requirement #1. GPU/shader knowledge enables the colorblind simulation. Rust/Python background enables native screen reader bridges. This is a **10/10 skill match** — there may be no other plugin developer on the Asset Store with this specific combination.

---

## 3. Figma accessible color palette generator: fastest path to revenue

**The gap:** No Figma plugin generates complete, WCAG-guaranteed accessible color systems from brand colors using perceptual color science. Stark dominates the accessibility space with **390,000+ users** but charges $12/month ($120/year) and receives complaints about pricing being "too expensive and rigid for individuals." Free tools like Able and A11y are basic single-purpose checkers. The new competitor Aulys has only **55 users** — the mid-market is wide open.

**Evidence of demand:** The EAA enforcement is driving design teams to validate accessibility earlier in the workflow. WCAG 2.2 added new criteria (Focus Appearance, Target Size) that most plugins don't cover. G2 reviews of Stark note it "does not offer automatic color correction." Designers want tools that fix problems, not just flag them.

**What to build (MVP in 2 weeks):** Input 1–3 brand colors, generate a full accessible color palette (10–12 shades per hue) using OKLCH perceptual color space with GPU-accelerated calculations. Mathematically guarantee every text/background combination passes WCAG 2.2 AA or AAA. Include real-time shader-based colorblind preview and export as Figma styles, W3C design tokens, and CSS variables.

**Pricing:** $5/month or $48/year via LemonSqueezy or Stripe (no Figma payment API waitlist needed). Free tier: 1 palette. Paid: unlimited palettes + exports + team sharing. **Figma takes 15%** if using native payments. At $5/month, need **200 subscribers for $1K/month** from a base of 13M+ Figma MAU.

**Why this developer:** GPU/shader expertise for perceptual color space transforms (Bradford chromatic adaptation, Brettel/Viénot models). AI/ML for palette optimization. Accessibility expertise for WCAG compliance validation. This is the **fastest to build and most differentiated** opportunity where shader skills create genuine technical moat.

---

## 4. Unreal/FAB accessibility compliance toolkit: best revenue split at 88/12

**The gap:** Mirrors the Unity gap but with even less competition. The only "Accessibility Toolkit" on FAB is a basic Blueprint template. In April 2025, a technical artist with color vision deficiency posted a formal request on Epic's forums titled *"Request for Colorblind & Accessibility Requirements"* — reporting that UE5.5's debug views became "completely unusable" for colorblind developers. **Epic didn't even have "Accessibility" as an issue type in their bug tracker.** The multisensory accessibility plugin on GitHub hasn't made it to FAB.

**Evidence of demand:** The CVAA compliance requirement affects all multiplayer games. ~8% of the population has color vision deficiency. Microsoft's Developer Accessibility Resources page lists UE accessibility tools as sparse. FAB's 88/12 revenue split means at $59, you keep **$51.92 per sale — need just ~20 sales/month** for $1K.

**Strategic angle:** Build a free Debug View Colorblind Mode plugin first (1 week) to establish reputation and gather reviews, then launch the paid Accessibility Compliance Toolkit ($49–$69) and cross-promote. This "free-to-paid funnel" is a proven FAB growth strategy. FAB's event sales generate **50% of monthly revenue** — timing launches around Fab Friday or seasonal sales is critical.

**Pricing:** Free colorblind debug tool → $59 paid toolkit. FAB data point: Electronic Nodes sells at $14.99 with 441 ratings (4.9★). More complex tools like Voxel Plugin Pro sell at $349.99. The **$49–$69 range** is well-supported for developer tools.

---

## 5. JetBrains federal compliance code scanner: zero competition, high willingness to pay

**The gap:** The JetBrains Marketplace has **zero plugins** for NIST SP 800-53, FedRAMP, FISMA, or CMMC compliance. The closest competitor, AIVory Guard, covers OWASP, GDPR, HIPAA, and PCI-DSS but explicitly lacks federal frameworks. Government contractors must comply with these standards and have IT tool budgets that dwarf indie developer spending. JetBrains users already pay $149–$249/year for IDEs — they expect and budget for quality tooling.

**Evidence of demand:** Federal compliance software is a booming market (Sprinto, Secureframe, Anchore exist as standalone SaaS). But no IDE-level integration exists. The "shift left" movement in security means developers want compliance checks at code-writing time, not deployment time. **~80% of FedRAMP authorizations are at Moderate level requiring ~325 NIST 800-53 controls.**

**What to build (MVP in 3 weeks):** Static analysis rules mapping to NIST 800-53 security controls — detect hardcoded credentials, weak encryption, missing input validation, insecure logging, missing audit trails. Map findings to specific control IDs (e.g., "SC-13: Cryptographic Protection"). Generate PDF compliance evidence reports for auditors. Support Python, TypeScript, and Rust. Add WCAG/Section 508 web accessibility checking as a second module for a "FedDev Compliance Suite."

**Pricing:** $49/year individual, $149/year organization. **JetBrains takes only 15%** (developer keeps 85%). BashSupport Pro successfully charges $23–$68/year for a niche language tool. At $49/year individual, need ~**290 annual subscribers** for $1K/month — or just **7 organization licenses at $149/year × 10 seats**.

**Why this developer:** Federal compliance expertise + Rust/Python/TypeScript multi-language support is an **extremely rare combination** on the JetBrains Marketplace. Most plugin developers focus on JVM languages. This is a genuine blue ocean.

---

## 6. Unity shader performance analyzer: high willingness to pay in a niche

**The gap:** Unity's shader debugging requires external tools — RenderDoc, PIX, Visual Studio Graphics Debugger, or platform-specific tools like Mali Offline Compiler. No in-editor shader complexity analysis exists. Unity's Frame Debugger shows draw calls but not shader cost breakdown. A "Shader Profiler" plugin appeared recently with minimal reviews. The Gabmeister blog notes: *"One tool that I wish Unity had by default is a reference viewer window"* — general sentiment that Unity's developer tools are lacking.

**What to build:** In-editor heatmap overlay showing per-pixel shader cost in Scene view. Shader complexity analyzer (instruction count, texture samples, branching). Automated optimization suggestions. URP/HDRP/Built-in pipeline support. Mobile GPU budget estimation.

**Pricing:** $39–$59. Smaller addressable market than accessibility tools but **very high willingness to pay** among professional shader developers. At $49 after Unity's 30% cut: $34.30/sale, need ~29 sales/month.

**Why this developer:** GPU/shader expertise is the literal core requirement. Few Unity plugin developers have the technical depth to build meaningful shader analysis tools. This is a **9/10 skill match** — the developer could build something technically superior to anything on the market.

---

## 7. AI-powered Unity test generation: no competition whatsoever

**The gap:** Unity has **no AI-powered test generation tool** on the Asset Store. The built-in Unity Test Framework requires manual NUnit test writing. AltTester moved to enterprise licensing. Unium Automated Test Tools and U2Tester are basic and unmaintained. No existing tool uses LLMs to analyze code and generate test scaffolding.

**What to build (MVP in 2 weeks):** Analyze MonoBehaviours/ScriptableObjects and auto-generate NUnit test stubs. Generate Play Mode test scenarios from scene analysis. One-click "smoke test" generation ensuring scenes load and core systems initialize. Editor window showing test coverage gaps.

**Pricing:** $39–$49. Testing tools aren't "sexy" but developers who need them will pay immediately. **Risk:** harder to market than accessibility tools.

---

## What successful solo plugin developers actually do

Research across BoringCashCow, IndieHackers, and MicroConf reveals consistent patterns among developers earning $1K+/month from plugins. **Hypermatic** built 12 Figma plugins generating an estimated **$1M/year** — each solving one specific, unglamorous pain point (image compression, text export, presentations). **Barn2 Media** reaches $24,000/month from WooCommerce plugins using annual subscriptions with auto-renewal. **CSS Scan** earned $100,000+ from a Chrome extension built in 50 hours — but only after repricing from $1.99 to significantly higher, proving that **underpricing is the most common mistake**.

The portfolio approach consistently outperforms single products. Unity publishers with 8–10 well-maintained assets reach $1,000–$3,000/month at the 12-month mark. Shopify's data shows the median app earns just $725/month, but the top 25% earn ~$13,917/month — **category choice matters 398x more than execution quality** (marketing apps average $19,900/year vs. reporting apps at $5/month).

Rob Walling's "Stair Step Approach" from MicroConf prescribes starting with marketplace plugins specifically: *"Pick something smaller in scope for your first at-bat. You can rely on mastering just one marketing channel."* Snir Alayof went from $0 to $30K+ MRR in under a year on monday.com's marketplace by posting *"everywhere where people were talking about monday.com"* — community presence, not paid ads, drives discovery.

The typical revenue curve across all marketplaces follows a pattern: launch spike from "new" badge visibility, sharp drop, then slow organic growth from marketplace search and word of mouth. **Expect 3–6 months to reach $500/month and 6–12 months to sustain $1,000/month.** Subscription renewals begin compounding after year one, creating a growing revenue baseline that transforms the economics.

---

## The recommended execution strategy

The research points to a clear playbook optimized for this developer's unique skills and the $1K/month target.

**Phase 1 (weeks 1–3): Build the Shopify AI Accessibility Auditor.** This has the strongest combination of regulatory urgency (EAA already in effect), favorable economics (0% commission on first $1M), proven demand (overlay apps getting sued), and massive price gap ($0–$100/month overlays vs. $1,000+/month real solutions). Ship the MVP as a freemium app: free 5-page audit for installs and reviews, $19–$39/month for full scanning and fix suggestions. Target: **$1,000 MRR by month 4–6.**

**Phase 2 (weeks 4–5): Build the Figma AccessiblePalette AI plugin.** This is the fastest to build (2 weeks), creates a second revenue stream with minimal overlap, and leverages GPU/shader skills for genuine technical differentiation. Use LemonSqueezy for payments to avoid Figma's approval waitlist. Price at $5/month. Target: **$500/month by month 6–8.**

**Phase 3 (weeks 6–8): Build the Unity Accessibility Toolkit.** The game industry's accessibility gap is the most dramatic — the only plugin hasn't been updated in 5 years. Start with the WCAG checker + colorblind simulation shader (leveraging code from the Figma plugin's color science). Price at $59 one-time. Target: **$500–$1,000/month by month 9–12.**

This phased approach creates **three revenue streams across three marketplaces** by week 8, all built on the same core accessibility expertise, with shared color science and WCAG validation code. The accessibility theme provides **a coherent brand identity** — being known as the developer who makes "THE BEST" accessibility tools across every major design and development platform.

## Conclusion

The intersection of accessibility compliance and AI represents a once-in-a-decade opportunity for a developer with this specific skill set. **Regulatory deadlines create non-discretionary demand** — merchants and studios don't choose whether to comply, only which tool to use. Across five marketplaces, the competitive landscape is remarkably similar: either no accessibility tools exist, or existing tools are abandoned, overlay-based (and legally ineffective), or priced exclusively for enterprise. The mid-market — affordable, technically sound, actually compliant — is empty everywhere. A developer with genuine WCAG expertise, GPU/shader skills for colorblind simulation, and AI/ML capabilities for automated auditing occupies a position that no current marketplace seller appears to match. The question isn't whether these tools would sell, but which marketplace to launch on first.