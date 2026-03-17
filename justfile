# Default recipe
default: test

# Run all tests
test:
    cargo test --workspace --all-features

# Run clippy lints (pedantic, deny warnings)
lint:
    cargo clippy --workspace --all-targets --all-features -- -D warnings

# Check formatting
fmt:
    cargo fmt --all -- --check

# Format code
fmt-fix:
    cargo fmt --all

# Build WASM bindings (web + nodejs)
wasm-build:
    wasm-pack build bindings/wasm --target web --out-dir pkg-web --scope perceive
    wasm-pack build bindings/wasm --target nodejs --out-dir pkg-node --scope perceive

# Run WASM Node.js integration tests
wasm-test:
    wasm-pack build bindings/wasm --target nodejs --out-dir pkg-node
    node tests/wasm_node_test.mjs

# Run benchmarks
bench:
    cargo bench --workspace

# Generate coverage report
coverage:
    cargo llvm-cov --workspace --all-features --html
    @echo "Report: target/llvm-cov/html/index.html"

# Run security and compliance checks
security:
    cargo audit
    cargo deny check all
    cargo machete

# Generate documentation
doc:
    RUSTDOCFLAGS="-D warnings" cargo doc --no-deps --workspace --all-features

# Full CI pipeline: fmt + lint + test + security + doc + wasm
ci: fmt lint test security doc wasm-test

# Build all targets
build:
    cargo build --workspace --all-features

# Build WASM and serve the demo locally at http://localhost:8765
demo:
    wasm-pack build bindings/wasm --target web --out-dir pkg
    ln -sfn ../bindings/wasm/pkg demo/pkg
    @echo "Serving demo at http://localhost:8765"
    python3 -m http.server 8765 --bind 127.0.0.1 --directory demo
