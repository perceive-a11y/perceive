# Boring software goldmines for a nights-and-weekends developer

**Your most lucrative opportunity sits at the intersection of your rarest skills: federal accessibility compliance paired with local AI deployment.** Three product categories stand out as realistic $2–5K/month targets buildable in 4–8 weeks of part-time work: an AI-assisted VPAT/ACR generator (zero middle-market competitors exist), a self-hosted PDF 508 remediation tool (every solution today is cloud-only), and a pastoral wellness app (literally no product exists for pastor self-care despite crisis-level burnout data). Each exploits a gap where your specific skill stack—Rust, Python, AI/ML, WCAG/508 expertise, federal healthcare domain knowledge, and Christian faith—creates an unfair advantage that generic developers cannot replicate.

The research below draws from marketplace revenue data, forum complaints, competitor pricing, regulatory timelines, and verified solo-developer income figures to identify the highest-confidence opportunities across six domains.

---

## Your unfair advantage is federal accessibility meets local AI

The most compelling opportunities cluster where two forces collide: **legally mandated compliance** (Section 508, ADA Title II, the European Accessibility Act effective June 2025) and **privacy requirements** that prevent sending sensitive documents to cloud APIs. No one is building for this intersection.

The digital accessibility testing tools market reached **$589–615 million in 2024** and is growing at 4–5% CAGR, with the government/public sector segment growing fastest at **9.24% CAGR**. Manual PDF remediation costs $5–$30 per page. AI cloud tools like Accessibility on Demand have dropped this to $0.30/page—but every single AI remediation tool is cloud-based. Federal agencies handling CUI, classified, or HIPAA-protected documents need on-premises solutions, and **none exist**. Meanwhile, VPAT/ACR generation—required for every product sold to the federal government—is stuck between free Word templates and $5,000+ enterprise consulting engagements, with no affordable middle option.

---

## The three highest-confidence product opportunities

### 1. VPAT Copilot: AI-assisted accessibility conformance reports

This is the single best-fit opportunity. Every vendor selling ICT products to the federal government must produce a Voluntary Product Accessibility Template (VPAT) or Accessibility Conformance Report (ACR). The current options are painful: manually fill in a Word template (tedious, error-prone, no guidance), pay Deque or Level Access **$5,000–$15,000** per report, or use the GSA's OpenACR Editor (functional but bare-bones, no AI assistance, no automated testing integration).

The product: point it at a URL or upload screenshots, it runs axe-core scans, maps findings to the VPAT 2.5 template structure (Chapters 3–6), pre-fills conformance levels and remarks using an LLM, and outputs valid ACRs in both Word and OpenACR YAML format. **No tool combines accessibility scanning with intelligent VPAT pre-population today.** The GSA's OpenACR project validates that the government wants machine-readable ACRs—you'd be building the tool that makes creating them easy.

Target pricing at **$149–$499 per report** or **$199–$399/month** for unlimited reports. At just 15 subscribers paying $299/month, that's $4,485/month. Your tech stack maps perfectly: TypeScript frontend, Python backend with axe-core integration and LLM inference, Rust for any PDF processing. MVP is achievable in **4–6 weeks**—integrate axe-core scanning, map results to VPAT template structure, add AI-generated remarks, output formatted documents.

The customer base is already in your network: small-to-mid software companies selling to government, federal subcontractors, and accessibility consultants. The European Accessibility Act creates additional international demand. VPAT is the **4th most searched term on Section508.gov**.

### 2. Self-hosted AI PDF 508 remediation tool

Every federal agency produces thousands of PDFs annually. All must be Section 508 compliant. Manual remediation runs **$5–$150 per page** and takes roughly 20 minutes per page. Cloud AI tools have compressed this to $0.30+/page, but federal agencies handling sensitive documents cannot use cloud services. **No self-hosted PDF remediation tool exists.**

Build a Rust-based PDF parser (for performance on batch processing thousands of pages) paired with Python ML models (YOLO for layout detection, LayoutLM for semantic understanding, local multimodal LLM for alt text generation). Upload a PDF, get back a tagged, remediated, PDF/UA-compliant document with a compliance report. Price at **$0.50–$2/page** or **$199–$999/month** for unlimited pages. The "data never leaves your network" positioning commands a **2–5x premium** over cloud alternatives, based on real market data from companies like Meetily (self-hosted AI meeting notes built in Rust).

MVP timeline is **6–8 weeks**, targeting the most common federal document types first (reports, forms, tables). You could start by using it in your own consulting work, billing remediation at $2–$5/page while the tool does it in seconds, then productize. Open-source the basic PDF checker to build trust in the federal space; charge for batch automation, API access, and alt text generation.

### 3. Pastoral wellness and burnout prevention app

This opportunity comes from a different direction but is equally compelling because **the competition is literally zero**. Barna Group longitudinal data shows pastoral burnout has reached crisis levels: **40% of pastors show high risk of burnout** (up from 11% in 2015), **18% have contemplated self-harm or suicide** in the past year, and excellent mental/emotional well-being among pastors dropped from 39% to just **14%** between 2015 and 2023.

Every existing pastoral care tool—Notebird ($9–12/user/month), CareNote, Undershepherd, Realm Shepherd—helps pastors care for their *congregation*. None help pastors care for *themselves*. The product: daily mood/energy/spiritual health check-ins, sabbath tracking, burnout risk scoring, Scripture-based self-care prompts, private AI-assisted journaling, and optional accountability partner connections. Build as a mobile-first web app in TypeScript with a Python AI backend.

Price at **$5–15/month** for individual pastors, **$29–79/month** for denominational or network licenses. With roughly 380,000 Protestant churches in the US alone, even 0.1% adoption at $9/month generates **$4,100/month**. MVP in **4–6 weeks**—the data model is simple, and the core value is in thoughtful design and theological sensitivity, not technical complexity. Go-to-market through pastor networks like Full Strength Network and Standing Stone, and denominational wellness programs.

---

## Federal compliance tools have a massive pricing gap

Beyond the VPAT and PDF remediation opportunities, the broader federal compliance documentation space reveals a **yawning gap between enterprise tools and manual processes**. Creating a System Security Plan (SSP) for NIST 800-53 compliance costs **$250,000–$1.5 million** when done manually and takes 6–24 months. Paramify, the leading automation tool, charges **$25,000–$60,000 per engagement**. RegScale and Cyber Sierra are similarly enterprise-priced. Small federal contractors managing 2–3 systems have no affordable option.

An "SSP Lite" tool—a self-service generator for NIST 800-53 control implementation statements that uses local LLMs to ensure sensitive security information stays on-premises—could fill this gap at **$99–$299/month per system**. Twenty customers at $199/month reaches $3,980/month. The FedRAMP 20x initiative, which aims to automate 80% of compliance requirements, and the ongoing NIST 800-53 Rev 5 transition create immediate demand. MVP timeline is 6–8 weeks: NIST control catalog, LLM-powered statement generation with RAG against compliance frameworks, template output.

The key insight across all federal tools: **compliance creates recurring revenue by its nature**. VPATs must be updated with every product change. ATOs require continuous monitoring. SSPs need annual review. Your customers can never stop needing you.

---

## Church and ministry software has real gaps despite a crowded market

The church management software market sits at roughly **$270 million–$1.2 billion** depending on scope definition, growing 5–10% annually. The major players—Planning Center, Tithely/Breeze, Subsplash—dominate the core ChMS space with pricing from $30/month (small church) to $500+/month (large church). Competing head-on with these platforms is inadvisable.

But the edges are full of gaps. Beyond the pastoral wellness app described above, two additional ministry opportunities have strong demand signals. First, an **AI sermon-to-content pipeline**: Pulpit AI by Subsplash turns sermon audio into devotionals, discussion questions, social posts, and blog content—but it's locked into the Subsplash ecosystem at $199+/month. A standalone version using Whisper for transcription and an LLM pipeline for content generation, priced at **$19–49/month** and self-hostable, would serve the 91% of pastors already using AI for sermon prep. MVP in 6–8 weeks.

Second, an **AI-powered small group curriculum generator**: input a passage or theme, output a complete multi-week study with discussion questions, leader notes, Scripture references, and application exercises. No dedicated, denomination-aware tool exists—churches either use generic ChatGPT prompts or buy expensive pre-packaged curriculum from publishers. Price at **$9–29/month** or $49–99/year. MVP in 4–6 weeks using RAG against a Bible and commentary corpus with theological guardrails.

Churches are **price-sensitive but willing to pay** for tools that save pastor time. The sweet spot for individual pastor tools is **$5–19/month**; for church-level tools, **$29–99/month**. Per-member pricing is deeply unpopular. Flat-rate or tiered-by-church-size models work best. Responsive customer support is a genuine differentiator—churches consistently cite it as a top factor.

---

## Game accessibility is a regulatory-driven greenfield

The game development tooling angle converges on one standout: **game accessibility compliance tools**. The European Accessibility Act (effective June 2025), Xbox Accessibility Guidelines (23 specific XAGs), and growing platform certification requirements from Microsoft, Sony, and Nintendo are creating demand that existing tools cannot meet.

The current state is remarkably poor. Unity's only accessibility plugin (UAP by MetalPop Games) is **free, abandoned since April 2021**, and built for Unity 5.6. Apple's Accessibility Plugin covers iOS only. EA's IRIS handles only photosensitivity for UE5. UA11Y is an unfunded academic thesis project. **No comprehensive, commercially maintained accessibility plugin exists for any game engine.**

A "GameAccess" toolkit for Unity could include an XAG/WCAG compliance scanner (editor tool that flags accessibility issues and generates compliance reports), drop-in components (color blind filters, text scaling, subtitle system, input remapping UI), and a pre-built accessibility settings menu prefab. Price the basic version at **$49**, Pro with compliance reports at **$99**, and Studio with full XAG audit at **$199**. Your WCAG expertise translates directly—contrast checking, text sizing, keyboard/controller navigation, and screen reader support are all problems you already know how to solve.

Unity Asset Store revenue data confirms the economics work for solo developers. Mid-tier publishers making **$3,000–$10,000/month** typically maintain 5–15 well-maintained assets in the $50–$200 range. Tools and editor extensions significantly outperform art assets. The platform takes a 30% cut but provides distribution to **10+ million users**. Top publishers like Procedural Worlds and More Mountains earn $15,000–$80,000+/month with focused portfolios.

---

## Plugin ecosystem economics and where they actually pay

Not all plugin marketplaces are created equal. The research reveals a clear hierarchy for monetization potential.

**Best for revenue**: Unity Asset Store (proven economics, $50–200 sweet spot for tools, 70/30 split), JetBrains Marketplace (professional users already paying $149–249/year for IDEs have low price sensitivity, native billing infrastructure, 85/15 split), and Shopify Apps ($1 billion in total app payouts in 2024, 0% commission under $1M, but brutal competition with 85–90% failure rate and $29–49/month "Goldilocks zone" pricing).

**Emerging but volatile**: FAB/Unreal Marketplace (best revenue share at 88/12 but platform is in post-transition turmoil—creators earned $24 million total in 2025 across 20,000+ publishers, meaning most earn very little), and Figma plugins (growing paid ecosystem with 15% commission but seller program currently at capacity).

**Avoid for direct revenue**: VS Code extensions (30+ million users but near-zero willingness to pay, no native payment infrastructure—use only as a marketing funnel), Obsidian plugins (no payment infrastructure, donation-only), and Raycast extensions (no monetization path).

**WordPress remains viable** for the right niche. The AI WordPress plugin market is estimated at **$500 million in 2025** and projected to reach $2.5 billion by 2033. Success stories include Barn2 Plugins ($1.7 million/year, husband-wife team, 16 products) and WP Rocket ($1M+/year). The key is avoiding saturated categories (SEO, forms, page builders) and targeting compliance-driven niches. An AI-powered WordPress accessibility plugin at **$99–199/year** could work, especially with the European Accessibility Act creating new compliance urgency.

---

## The "boring product" playbook that actually works

Verified solo-developer success stories reveal consistent patterns. The Bank Statement Converter—a tool that converts PDF bank statements to Excel/CSV—generated **$16,000–$38,000 MRR** with roughly $500/month in operating costs, built by one developer, grown entirely through SEO with zero ad spend. Preceden (an online timeline maker) earns **$10,000/month**. JobBoardSearch, described by its creator as "boring, simple, clunky design," was built in 5 hours and generates **$7,000/month**. SaaS Pegasus, a Django boilerplate, provides 80% of its solo creator's income from over 1,000 customers.

The MicroConf 2024 survey shows **18% of indie SaaS founders sit in the $1K–$5K MRR range**, which is the target sweet spot. Roughly 95% of micro-SaaS products reach profitability within their first year, and 39% of independent SaaS founders are solo operators. The five success patterns that repeat across boring product winners are worth internalizing:

- **SEO drives growth for boring tools.** Bank Statement Converter, Preceden, and JobBoardSearch all grew primarily through organic search. Blog content ranking for long-tail keywords is the primary acquisition channel.
- **Price for businesses, not consumers.** Products charging $30–99/month to businesses consistently outperform consumer tools.
- **Do one thing perfectly.** FormBackend handles form submissions. Bank Statement Converter converts bank statements. Narrow focus wins.
- **Operating costs stay tiny.** Bank Statement Converter runs on ~$500/month. Margins of 80–90% are standard.
- **Compliance equals built-in retention.** Nobody stops needing compliance. This is the strongest argument for the federal tools path.

---

## A self-hosted AI clinical notes tool for therapists is a sleeper hit

One opportunity that emerged strongly from the AI tools research deserves separate attention. There are **198,000+ licensed therapists** in private practice in the US, and **87% are not yet using AI** for clinical documentation. Every existing AI note-taking tool for therapists—Yung Sidekick ($39.99/month), Mentalyc, Upheal, AutoNotes, Quill—is cloud-based. **Not a single tool offers true local/self-hosted processing** for clinical session notes, despite therapists handling some of the most sensitive data imaginable.

A Tauri desktop app (Rust-based, cross-platform) with local Whisper for transcription and a local LLM for SOAP/DAP/BIRP note generation—where data never leaves the device—would be the only product in its category with genuine offline capability. Price at **$39–79/month** for individual therapists, **$199+/month** for group practices. The "data never leaves your device" positioning is not just a feature—it's the entire value proposition for a profession where a data breach can mean losing your license. MVP in **4–6 weeks** using whisper.cpp (Rust bindings), Ollama, and Tauri.

This is further from your core domain than the federal compliance tools, but the privacy-first AI expertise and Rust/Python skills map perfectly. It's also a product with clear word-of-mouth potential—therapists in private practice form tight referral networks.

---

## Conclusion: a recommended 90-day action plan

The research points to one clear first product: **the VPAT Copilot**. It has the highest confidence of reaching $2–5K/month because it targets a legally mandated need with zero middle-market competition, leverages your most differentiated skills (WCAG/508 + AI + federal domain), has a clear customer base you can reach through your existing professional network, and can reach MVP in 4–6 weeks. The self-hosted PDF 508 remediation tool is the natural second product—it shares the same customer base and technology foundation, creating an accessibility compliance product suite.

The pastoral wellness app is the recommended "passion project" to pursue in parallel. It requires less technical complexity, aligns with your values, and addresses a genuinely urgent human need with literally no competition. Building it open-source with an optional hosted tier would match your self-hosted philosophy while still generating revenue.

The game accessibility toolkit is the strongest plugin marketplace opportunity, worth pursuing once the first product is generating revenue. The regulatory tailwind from the EAA and XAGs is real, the competition is essentially nonexistent, and your WCAG expertise translates directly.

What makes these opportunities compelling isn't any single factor—it's the convergence. **Legally mandated demand** means customers can't opt out. **Privacy requirements** mean cloud-only competitors can't serve the market. **Technical depth** (Rust + AI/ML + WCAG) means most developers can't build what you can. And **domain expertise** from federal healthcare consulting means you understand the customer's world in a way that outsiders don't. That's not a theoretical moat. That's a real one.