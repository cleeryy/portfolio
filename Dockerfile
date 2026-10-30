# syntax=docker/dockerfile:1
#
# Static build: Vite + React 19 (no backend).
#   builder : node:22-alpine + pnpm 9 -> /app/dist
#   runtime : nginx-unprivileged 1.27 (uid 101, listens on 8080)

# --------------------------- builder ---------------------------
FROM node:22-alpine AS builder

WORKDIR /app

# pnpm pinned to the major used by the lockfile (lockfileVersion 9.0).
RUN corepack enable && corepack prepare pnpm@9 --activate

# Dependency layer first: only invalidated when the manifest/lockfile change.
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Then the sources (src/, index.html, vite/ts configs, public/).
COPY . .
RUN pnpm build

# --------------------------- runtime ---------------------------
# Unprivileged variant: runs as uid 101 (nginx), writes pid/temp to /tmp,
# and its main nginx.conf already points temp paths at /tmp — so no chown
# of /var/cache/nginx or /var/run is needed. Listens on 8080.
FROM nginxinc/nginx-unprivileged:1.27-alpine AS runtime

# SPA routing + caching + security headers.
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Only the compiled output ships: no node, no pnpm, no dev dependencies.
COPY --chown=nginx:nginx --from=builder /app/dist /usr/share/nginx/html

# Fail the image build (not the deploy) if the config is invalid.
# Runs as uid 101, exactly like runtime, so permission problems surface here.
RUN nginx -t

# The base image already sets USER 101; kept explicit for auditors.
USER 101

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://127.0.0.1:8080/ >/dev/null || exit 1

CMD ["nginx", "-g", "daemon off;"]
