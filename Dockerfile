FROM node:20-slim AS builder

WORKDIR /app

ENV NODE_OPTIONS="--max-old-space-size=4096"

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:20-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8088
ENV DB_PATH=/app/data/hotel.db

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.js ./

RUN mkdir -p /app/data

EXPOSE 8088

CMD ["node", "server.js"]