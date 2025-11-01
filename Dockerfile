# syntax=docker/dockerfile:1

###############################################################################
# Build stage
# - Installs Bun dependencies
# - Installs MkDocs toolchain (Python)
# - Runs the Bun build + MkDocs build so the runtime image only needs artifacts
###############################################################################
FROM oven/bun:1 AS builder

WORKDIR /app

# Install Python + venv tooling for the MkDocs toolchain
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 python3-pip python3-venv \
  && rm -rf /var/lib/apt/lists/*

# Create an isolated virtualenv for docs tooling
ENV VIRTUAL_ENV=/opt/venv
RUN python3 -m venv "$VIRTUAL_ENV"
ENV PATH="$VIRTUAL_ENV/bin:$PATH"

# Copy lockfiles first to maximise layer caching on dependency installs
COPY bun.lock bunfig.toml package.json tsconfig.json requirements.txt ./

# Install JS dependencies (Bun) and Python tooling for docs
RUN bun install --frozen-lockfile
RUN pip install --upgrade pip \
  && pip install --no-cache-dir -r requirements.txt

# Copy the rest of the source tree and produce build artifacts
COPY . .
RUN bun run build
RUN mkdocs build --clean

###############################################################################
# Runtime stage
# - Copies only the build outputs + runtime sources
# - Installs production dependencies
# - Starts the Bun server
###############################################################################
FROM oven/bun:1-slim AS runner

WORKDIR /app

# Ensure Bun/React run in production mode by default
ENV NODE_ENV=production
# DigitalOcean App Platform injects PORT; default to 8080 for local usage
ENV PORT=8080

# Copy package metadata and lockfile for deterministic installs
COPY package.json bun.lock bunfig.toml tsconfig.json ./

# Install only production dependencies (excludes devDependencies)
RUN bun install --frozen-lockfile --production

# Copy build outputs and runtime assets from the builder image
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src ./src
COPY --from=builder /app/data ./data
COPY --from=builder /app/examples ./examples
COPY --from=builder /app/templates ./templates

# Expose the HTTP port and launch the Bun server
EXPOSE 8080
CMD ["bun", "src/index.tsx"]
