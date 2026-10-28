# syntax=docker/dockerfile:1

# ---------- base ----------
FROM node:24-alpine AS base
WORKDIR /usr/src/app

# ---------- deps: todas as dependências (dev incluso) ----------
FROM base AS deps
COPY package.json package-lock.json prisma7.config.ts ./
COPY prisma ./prisma
# O postinstall executa `prisma generate`, que precisa do schema já copiado.
RUN npm ci

# ---------- development: hot reload ----------
FROM deps AS development
ENV NODE_ENV=development
COPY . .
RUN npx prisma generate
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && npm run start:dev"]

# ---------- build ----------
FROM deps AS build
COPY . .
RUN npx prisma generate && npm run build

# ---------- production: apenas runtime ----------
# --omit=optional remove o Prisma CLI/Studio, peers opcionais do @prisma/client.
FROM base AS production
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --omit=optional --ignore-scripts && npm cache clean --force
COPY --from=build /usr/src/app/dist ./dist
USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]
