# Stage 1: Build the Rust napi-rs native module
FROM rust:1.88-bookworm AS rust-builder

# Install napi-rs CLI and Node.js (needed by napi-rs build)
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && npm install -g @napi-rs/cli

WORKDIR /build

# Copy workspace-level files
COPY Cargo.toml Cargo.lock ./

# Copy all workspace crates the native module depends on
COPY crates/ crates/
COPY products/shopify-auditor/scanner/ products/shopify-auditor/scanner/
COPY products/shopify-auditor/native/ products/shopify-auditor/native/

# Stub out wasm workspace member (not built, but cargo needs it to resolve)
COPY bindings/wasm/Cargo.toml bindings/wasm/Cargo.toml
RUN mkdir -p bindings/wasm/src && echo "// stub" > bindings/wasm/src/lib.rs

# Build the native module in release mode
WORKDIR /build/products/shopify-auditor/native
RUN cargo build --release \
    && cp /build/target/release/libshopify_auditor_native.so shopify-auditor.node


# Stage 2: Build the Remix app
FROM node:20-bookworm-slim AS app-builder

WORKDIR /app

COPY products/shopify-auditor/web/package.json products/shopify-auditor/web/package-lock.json ./
RUN npm ci

COPY products/shopify-auditor/web/ .
RUN npx prisma generate \
    && npm run build \
    && npm prune --omit=dev


# Stage 3: Production image
FROM node:20-bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy node_modules (includes prisma client, no Playwright in production)
COPY --from=app-builder /app/node_modules ./node_modules
COPY --from=app-builder /app/build ./build
COPY --from=app-builder /app/package.json ./

# Copy Prisma schema (needed for migrations at startup)
COPY --from=app-builder /app/prisma ./prisma

# Copy the Rust native module into the expected location
COPY --from=rust-builder /build/products/shopify-auditor/native/shopify-auditor.node ./native/shopify-auditor.node

# SQLite database lives on a persistent Fly volume mounted at /data
ENV DATABASE_URL="file:/data/prod.db"
ENV NODE_ENV="production"
ENV PORT="3000"

EXPOSE 3000

# At startup: push schema to the database, then launch the Remix server
CMD DATABASE_URL="file:/data/prod.db" npx prisma db push --skip-generate \
    && npx remix-serve build/server/index.js
