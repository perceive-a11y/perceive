# Default recipe
default: test

# Run all tests
test:
    cargo test --workspace

# Run clippy lints
lint:
    cargo clippy --workspace --all-targets -- -D warnings

# Check formatting
fmt:
    cargo fmt --all -- --check

# Format code
fmt-fix:
    cargo fmt --all

# Build WASM bindings
wasm-build:
    wasm-pack build bindings/wasm --target web

# Run benchmarks
bench:
    cargo bench --workspace

# Run tests + lint + fmt check
ci: fmt lint test

# Build all targets
build:
    cargo build --workspace
