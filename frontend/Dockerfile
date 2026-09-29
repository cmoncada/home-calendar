# Construir desde la raíz del repo:  docker build -f frontend/Dockerfile --target prod .
FROM node:24-alpine AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN npm install -g pnpm@11.17.0
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile --filter frontend

# ---------- Desarrollo: Vite con HMR ----------
FROM base AS dev
WORKDIR /app/frontend
EXPOSE 5173
CMD ["pnpm", "dev"]

# ---------- Build estático ----------
FROM base AS build
COPY frontend/ frontend/
RUN pnpm --filter frontend build

# ---------- Producción: Nginx sirve el SPA y hace proxy a la API ----------
FROM nginx:stable-alpine AS prod
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/frontend/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD wget -qO- http://127.0.0.1/healthz || exit 1
