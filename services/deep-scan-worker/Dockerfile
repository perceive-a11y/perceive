FROM node:20-bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# Install Chromium and all its system dependencies via Playwright
RUN npx playwright install --with-deps chromium

COPY server.mjs scan-engine.mjs ./

ENV PORT=8080
EXPOSE 8080

CMD ["node", "server.mjs"]
