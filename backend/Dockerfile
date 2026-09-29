# Construir desde la raíz del repo:  docker build -f backend/Dockerfile --target prod .
FROM node:24-alpine AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN npm install -g pnpm@11.17.0 && apk add --no-cache tzdata
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/

# ---------- Desarrollo: código montado como volumen, recarga con node --watch ----------
FROM base AS dev
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile --filter backend
WORKDIR /app/backend
EXPOSE 3000
CMD ["pnpm", "dev"]

# ---------- Producción ----------
FROM base AS prod
ENV NODE_ENV=production
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile --prod --filter backend
COPY backend/src backend/src
COPY backend/migrations backend/migrations
COPY backend/public backend/public
RUN mkdir -p /data/uploads && chown -R node:node /data
USER node
WORKDIR /app/backend
ENV UPLOADS_DIR=/data/uploads PORT=3000
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1
CMD ["node", "src/index.js"]
