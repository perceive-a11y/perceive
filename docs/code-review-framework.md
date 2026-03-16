# Phosphor code review framework for r/rust

**A prioritized audit checklist for a Rust + WebGPU + egui particle effects application, designed to be executed systematically by an AI coding assistant.** This framework synthesizes idiomatic Rust patterns, egui architecture guidelines, wgpu best practices, performance patterns for 5–10M+ particles, project hygiene standards, and r/rust community expectations into a single actionable review process. The developer used heavy AI assistance (Claude Code) with decades of general software experience but limited Rust-specific expertise — the review must specifically target AI-generated code smells and non-idiomatic patterns that the Rust community will immediately flag.

---

## Tier 1: Blocking issues that will draw immediate criticism

These items represent the minimum quality bar. Experienced Rustaceans clone repos and run these checks first — failures here signal carelessness and will overshadow everything else.

**Toolchain compliance.** Run `cargo fmt --all -- --check` with zero deviations. Run `cargo clippy --all-targets --all-features -- -D warnings` with zero warnings. Non-standard formatting or clippy warnings are the single fastest way to lose credibility on r/rust. If any clippy lints are suppressed with `#[allow(...)]`, each must have a comment explaining why. The `clippy::correctness` and `clippy::suspicious` groups are mandatory (deny-level); `clippy::perf` is critical for a real-time app. Consider enabling `clippy::pedantic` and `clippy::nursery` at warn level, selectively allowing noisy lints like `module_name_repetitions`, `cast_possible_truncation`, and `too_many_lines`.

**Error handling audit.** Grep the entire codebase for `.unwrap()`, `.expect(`, `panic!`, `todo!()`, and `unimplemented!()`. Every occurrence must be justified or converted to `?`/`Result`. The rule: **`.unwrap()` is acceptable only in tests and in cases where the invariant is provably upheld** (e.g., parsing a hardcoded string), and even then `.expect("reason")` is preferred with a comment explaining the invariant. Library-style modules should never panic. Use `thiserror` for error types where callers need to distinguish variants (shader compilation errors, GPU resource errors), and `anyhow` with `.context()` at the application level. This is the **#1 AI-generated code smell** — LLMs liberally sprinkle `.unwrap()` everywhere.

**Unsafe code documentation.** Every `unsafe` block must have a `// SAFETY:` comment explaining why the invariants hold. Enable the `clippy::undocumented_unsafe_blocks` lint. The r/rust community scrutinizes `unsafe` intensely. If WebGPU FFI code requires `unsafe`, wrap it in safe abstractions and minimize the surface area. If `unsafe` is used for performance (unchecked indexing, transmutes), benchmark to prove it actually helps and document the proof.

**License and legal.** Use dual `MIT OR Apache-2.0` (the Rust ecosystem convention, used by rustc itself). Set `license = "MIT OR Apache-2.0"` in Cargo.toml and include both `LICENSE-MIT` and `LICENSE-APACHE` files in the repo root. Missing license files are a red flag — some community members won't even examine unlicensed code.

**README with visuals.** For a particle effects application, **a README without screenshots or GIFs is dead on arrival.** The README is the single most important artifact for an r/rust post. It must include: a clear one-sentence description, an embedded GIF or video showing the effects in action, build/run instructions (ideally just `cargo run`), WebGPU prerequisites (GPU drivers, supported backends), and an honest statement of project maturity and known limitations.

---

## Tier 2: Idiomatic Rust patterns that experienced reviewers will flag

These are the patterns that distinguish "someone who knows Rust" from "someone whose AI wrote Rust." Fixing these before posting dramatically changes the reception.

**Clone abuse and unnecessary allocations.** This is the second-biggest AI code smell. Search for `.clone()` on heap-allocated types (`Vec`, `String`, `HashMap`, `Arc`) — especially inside loops or per-frame code paths. Every `.clone()` should be questioned: can you borrow instead? Move instead? Use `Rc`/`Arc` for shared ownership? Similarly, check for `Arc<Mutex<T>>` used as a general-purpose solution to borrow checker errors rather than restructuring ownership. The pattern `Arc<Mutex<T>>` scattered throughout application code is a telltale sign of "fighting the borrow checker" and will be called out.

**Function signature hygiene.** Check every function signature for these common anti-patterns:
- `&Vec<T>` → should be `&[T]` (more general, works with arrays too)
- `&String` → should be `&str`
- `&Box<T>` → should be `&T`
- Functions that only read strings taking `String` instead of `&str`
- Functions returning `Vec<T>` when returning an iterator would be lazier and more efficient
- Boolean parameters where enums would be clearer: `fn render(wireframe: bool)` → `fn render(mode: RenderMode)`

**Iterator usage.** Replace manual `for i in 0..vec.len()` index loops with iterator chains (`.iter()`, `.filter()`, `.map()`, `.collect()`). Use `.enumerate()` instead of manual indexing, `.filter_map()` instead of `.filter().map()`, and avoid `.collect::<Vec<_>>()` when the iterator can be consumed directly. In hot paths (per-frame particle processing), unnecessary `.collect()` calls create allocations that matter.

**Option/Result combinators.** Replace verbose `match` arms with combinators: `opt.map(transform)` instead of matching `Some`/`None`, `.unwrap_or_default()` instead of match-with-default, `.context("msg")?` instead of `.map_err(|e| ...)`. Use `Option::transpose()` for `Option<Result<T>>` ↔ `Result<Option<T>>` conversions.

**Pattern matching completeness.** Avoid wildcard catch-all `_ =>` in match arms on owned enums — spell out all variants so the compiler warns when new variants are added. Use `if let` for single-arm matches. Use slice pattern matching (`match items.as_slice() { [] => ..., [single] => ..., _ => ... }`) instead of index-based access with bounds checks.

**String handling.** Functions that only read strings should accept `&str`, not `String`. Use `Cow<'_, str>` when a function sometimes returns borrowed data and sometimes allocates. Avoid `format!()` in hot paths — use `write!` to a pre-allocated buffer or cache formatted strings. Check for `.to_string()` and `.to_owned()` on string literals where `&str` would suffice.

**Derive macro completeness.** Per the Rust API Guidelines, all public types should derive `Debug` (mandatory), and where appropriate: `Clone`, `PartialEq`/`Eq`, `Hash`, `Default`, `Send + Sync`. For GPU data types, ensure `bytemuck::Pod + Zeroable` are derived alongside `#[repr(C)]`.

**Visibility discipline.** Default to private. Use `pub(crate)` for items shared across modules but not part of the public API. Structs should have private fields where possible (forces constructor usage, enables future changes). Use `#[non_exhaustive]` on public enums to allow adding variants without breaking changes. Getters should not use the `get_` prefix (`fn name(&self) -> &str`, not `fn get_name()`).

---

## Tier 3: WebGPU/wgpu architecture patterns specific to Phosphor

These items are specific to the GPU compute pipeline and will be noticed by anyone familiar with wgpu or real-time graphics.

**Ping-pong double-buffer for particle state.** The standard pattern for GPU particle systems: use two storage buffers and two pre-created bind groups. Each frame, the compute shader reads from buffer A and writes to buffer B; next frame, swap. Pre-create both bind groups at initialization — never recreate bind groups per frame. Verify the codebase uses this pattern rather than a single read-write buffer (which causes data races).

**Pipeline and bind group lifecycle.** **Never recreate pipelines or bind groups inside the render loop.** Pipeline creation involves shader compilation and driver work — it must happen once at initialization or on configuration change. Verify that `device.create_compute_pipeline()`, `device.create_render_pipeline()`, and `device.create_bind_group()` are not called per-frame. Consider implementing `PipelineCache` for faster startup on subsequent runs.

**Workgroup size optimization.** Verify compute shaders use `@workgroup_size(64)` or higher (not `@workgroup_size(1, 1, 1)`, which leaves >98% of GPU capacity unused). Dispatch should be `(particle_count + 63) / 64` workgroups. Each compute shader should include a bounds check: `if (gid.x >= particle_count) { return; }`.

**Keep particle data on the GPU.** For 5–10M particles, the PCIe bus is the bottleneck. Particle position/velocity data should **never leave the GPU** during normal simulation. Chain compute and render passes in a single command encoder submission (WebGPU provides implicit synchronization within a submission). Only read back data for debugging, not for normal rendering. If CPU-side particle counts are needed, use atomic counters or indirect draw buffers.

**Buffer management.** Verify buffer usage flags are correct and minimal: storage buffers need `STORAGE | VERTEX` (plus `COPY_SRC` only if readback is needed), uniform buffers need `UNIFORM | COPY_DST`. Declare input-only buffers as `var<storage, read>` in WGSL (not `read_write`) to skip synchronization barriers. For per-frame uniform updates, prefer `wgpu::util::StagingBelt` or `queue.write_buffer_with()` over raw `queue.write_buffer()`, which allocates a temporary staging buffer each call.

**WGSL alignment.** `vec3<f32>` has **16-byte alignment** in WGSL, not 12. This is the most common WebGPU alignment bug. Prefer `vec4<f32>` for struct fields to avoid padding surprises. On the Rust side, ensure all GPU-shared structs use `#[repr(C)]` with `bytemuck::Pod + Zeroable`, and verify padding matches WGSL layout expectations.

**Resource labeling.** Verify every buffer, pipeline, bind group, texture, and command encoder has a descriptive `label: Some("...")`. Labels appear in wgpu error messages and make debugging with hundreds of GPU resources tractable. Missing labels is a common oversight that signals inexperience with wgpu.

**Error resilience.** Check for proper handling of `surface.get_current_texture()` errors — `SurfaceError::Lost` should trigger reconfiguration, `SurfaceError::OutOfMemory` should be fatal. Consider implementing error scopes (`device.push_error_scope`) around pipeline creation and buffer allocation for graceful degradation.

---

## Tier 4: egui integration architecture

**Separation of computation from UI loop.** The `update()` method runs every frame. Verify that no heavy computation (shader compilation, FFT analysis, parameter computation, file I/O) happens inside `update()`. egui typically takes **1–2ms per frame** for UI layout — any additional blocking work directly eats the frame budget. Heavy operations should run on background threads with results communicated via channels (`std::sync::mpsc` or crossbeam), with `ctx.request_repaint()` called from the background thread when new data is available.

**State ownership model.** Application state must live in the app struct, not in `egui::Memory`. egui's `Memory` stores only superficial widget state (scroll positions, collapsed headers). Verify the codebase follows this pattern: a well-structured `App` struct with decomposed sub-structs for different subsystems (pipeline state, UI state, render state), not a flat grab-bag of fields.

**egui-wgpu integration pattern.** For custom WebGPU rendering alongside egui, the canonical approach uses `egui_wgpu::CallbackTrait` with three phases: `prepare()` for uploading uniforms and running compute passes, and `paint()` for issuing draw commands during egui's render pass. GPU resources should be stored in `Renderer::callback_resources` (a type-map), not in the main app struct. Verify this architecture is followed rather than an ad-hoc integration.

**Repaint strategy.** For continuous animation (which Phosphor needs), verify that `ctx.request_repaint()` is called every frame or `ctx.request_repaint_after(Duration::from_millis(16))` is used for throttled updates. Check that minimized windows skip rendering: `let minimized = ctx.input(|i| i.viewport().minimized).unwrap_or_default()`.

**Context lock safety.** egui uses closure-based accessors (`ctx.input(|i| ...)`, `ctx.memory_mut(|m| ...)`) to prevent deadlocks. Verify no code holds Context locks across closure boundaries, which will deadlock.

---

## Tier 5: Performance patterns for real-time particle processing

**Data layout for cache efficiency.** For 5–10M particles, memory layout dominates CPU-side performance. Struct-of-Arrays (SoA) layout — separate `Vec<f32>` per field — is **~30% faster in simple cases, up to 10x in complex cases** compared to Array-of-Structs, because cache lines load only the fields needed per pass. If the codebase uses AoS for CPU-side particle data, flag it as a potential optimization. For GPU-side data, struct layout matters less (GPU memory bandwidth is different), but minimize per-particle struct size to reduce VRAM usage — at 10M particles, every 4 bytes costs 40MB.

**Pre-allocation and buffer reuse.** Verify `Vec::with_capacity()` is used wherever sizes are known or estimatable. Per-frame temporary buffers should use `.clear()` (resets length, keeps capacity) rather than reallocation. Check for allocations inside the main loop — `format!()`, `.collect()`, `Vec::new()` without capacity, `String::new()` followed by pushes.

**Release build configuration.** Verify `Cargo.toml` includes optimized release profile settings: `opt-level = 3`, `lto = "fat"` (10–20% improvement), `codegen-units = 1` (better cross-function optimization). Consider `target-cpu=native` in `.cargo/config.toml` for auto-vectorization with AVX2/AVX-512. **An alternative allocator** (`mimalloc` or `tikv-jemallocator`) can provide ~20% improvement for allocation-heavy workloads including egui's per-frame mesh reconstruction.

**Rayon parallelism.** If CPU-side particle updates exist (beyond GPU compute), verify Rayon's `par_iter_mut()` / `par_chunks_mut()` is used with appropriate minimum chunk sizes (`.with_min_len(1000)` or similar) to amortize thread pool overhead. Consider reserving one core for the GPU submission thread: `rayon::ThreadPoolBuilder::new().num_threads(num_cpus::get() - 1)`. Avoid `Mutex` inside parallel loops — use `fold`/`reduce` patterns instead.

**Profiling infrastructure.** Check for integration with profiling tools: `puffin` for per-frame timing, support for `tracy` or `cargo-flamegraph` via a feature flag. Verify `[profile.release] debug = true` is available (commented or behind a profile) for profiling release builds with symbol information.

---

## Tier 6: Project structure and hygiene

**Cargo.toml completeness.** Required fields: `name`, `version` (semver), `edition` (2021 or 2024), `description`, `license`, `repository`, `readme`, `rust-version` (MSRV). For applications not published to crates.io, add `publish = false`. Use `[workspace.dependencies]` for consistent dependency versions across crates. Use `[workspace.lints]` for shared lint configuration.

**Workspace organization.** For a project with rendering, UI, compute, and core subsystems, a workspace with a flat `crates/` layout is strongly recommended. Use a virtual manifest (root Cargo.toml has `[workspace]` but no `[package]`). Suggested decomposition: `crates/app/` (thin binary), `crates/core/` (types, config, errors), `crates/renderer/` (wgpu pipelines), `crates/compute/` (GPU simulation), `crates/ui/` (egui panels and widgets). Even if the current codebase is a single crate, verify that `main.rs` is thin (init, config, dispatch) with all logic in `lib.rs` modules.

**CI/CD workflow.** A minimal GitHub Actions workflow should run: `cargo fmt --check`, `cargo clippy -D warnings`, `cargo test --all-features`, and optionally `cargo deny check` and `cargo doc --no-deps`. Use `dtolnay/rust-toolchain@stable` (not the deprecated `actions-rs`), `Swatinem/rust-cache@v2` for dependency caching, and set `RUSTFLAGS: "-Dwarnings"` globally. A green CI badge in the README signals quality.

**Dependency audit.** Run `cargo audit` for known vulnerabilities. Run `cargo-udeps` to find unused dependencies. Verify dependency count is reasonable — the community is wary of bloat. Set up `deny.toml` for automated license checking, advisory scanning, and multiple-version detection.

**Test coverage.** Zero tests is a warning sign. At minimum, unit tests should cover core logic (parameter calculations, particle lifecycle, configuration parsing). Integration tests or runnable examples that demonstrate key features are valued. Doc tests in public API documentation serve as both tests and examples.

**Documentation.** Module-level `//!` comments describing each module's purpose. Public items should have `///` doc comments. Inline comments should explain **why**, not **what**. For a project not on crates.io, README quality matters more than full rustdoc coverage, but basic doc comments show code maturity.

---

## The AI assistance disclosure strategy

The r/rust community is **notably skeptical of AI-generated code.** Common concerns: excessive `.clone()` and `.unwrap()`, hallucinated crate APIs, non-idiomatic patterns, and lack of understanding. However, the community respects transparency and genuine understanding.

**Recommended approach:** Be upfront about AI assistance but frame it as "AI-assisted, human-reviewed." Emphasize specific architectural decisions you made, design tradeoffs you evaluated, and bugs you caught. Demonstrate understanding by being able to explain any code if asked. **Remove obvious AI fingerprints** before posting: repetitive comment patterns, overly verbose documentation that sounds generated, unnecessary abstractions, and any hallucinated API calls. The strongest defense is clean, idiomatic code that speaks for itself — if the code is good, the tool that helped write it matters less.

---

## Execution order for the audit

Hand this to Claude Code with the following sequenced instructions:

**Phase 1 — Automated checks (5 minutes).** Run `cargo fmt --check`, `cargo clippy --all-targets --all-features -- -D warnings`, `cargo test`, and `cargo audit`. Fix all findings before proceeding.

**Phase 2 — Error handling sweep (30 minutes).** Grep for `unwrap()`, `expect(`, `panic!`, `todo!()`, `unsafe`. Categorize each as justified or needs-fix. Convert unjustified panics to `Result` with `?` and `.context()`. Document every `unsafe` block with `// SAFETY:`.

**Phase 3 — Idiomatic Rust pass (45 minutes).** Review all function signatures for `&Vec<T>`, `&String`, `&Box<T>`, unnecessary `String` parameters. Search for `.clone()` on heap types and evaluate each. Replace manual index loops with iterators. Check derive completeness on public types. Verify visibility discipline (`pub(crate)` vs `pub`).

**Phase 4 — Architecture review (30 minutes).** Verify egui `update()` contains no blocking computation. Check wgpu pipeline/bind group lifecycle (created once, reused). Verify ping-pong buffer pattern for particle state. Check WGSL alignment (`vec3` → `vec4`). Verify all GPU resources are labeled. Check that particle data stays on GPU.

**Phase 5 — Project hygiene (20 minutes).** Verify Cargo.toml completeness, license files present, README has visuals and build instructions, CI workflow exists, basic tests exist, dependencies are current and justified.

**Phase 6 — Performance review (20 minutes).** Check release profile configuration. Verify pre-allocation patterns in hot paths. Check for allocations inside the main loop. Verify Rayon usage (if applicable) has appropriate chunk sizes. Confirm `#[repr(C)]` on GPU-shared structs.

This framework is designed to be exhaustive but prioritized — completing Phases 1–3 alone will address the issues most likely to draw negative feedback on r/rust. Phases 4–6 elevate the project from "acceptable" to "impressive."