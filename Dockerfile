# ──────────────────────────────────────────────────────────────────────────────
# Dockerfile — IoT Herbal Storage System (Next.js + Python ML)
# Works on Railway (8GB RAM — full ML) and Render (512MB — set DISABLE_LSTM=1)
# ──────────────────────────────────────────────────────────────────────────────

# ── Stage 1: Build Next.js ──────────────────────────────────────────────────
FROM node:20-slim AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN npm run build
RUN npm prune --omit=dev

# ── Stage 2: Production ─────────────────────────────────────────────────────
FROM node:20-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Install Python 3 + pip for ML scripts
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      python3 \
      python3-pip \
      python3-venv \
    && rm -rf /var/lib/apt/lists/*

# Create a virtual environment for Python packages
RUN python3 -m venv /opt/ml-venv
ENV PATH="/opt/ml-venv/bin:$PATH"

# Install Python ML dependencies
COPY scripts/requirements-ml.txt /tmp/requirements-ml.txt
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r /tmp/requirements-ml.txt && \
    rm /tmp/requirements-ml.txt

# Copy built application
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.mjs ./next.config.mjs

# Copy Python ML scripts
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/lib ./lib

# Create ml_models directory for trained model storage
RUN mkdir -p /app/ml_models

# Set Python path to the venv python
ENV PYTHON_PATH="/opt/ml-venv/bin/python3"
ENV ENABLE_PYTHON_ML=1
ENV USE_ENSEMBLE_ANOMALY=1

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["npm", "start"]
