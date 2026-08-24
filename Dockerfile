# Stage 1: Build React frontend
FROM node:24-alpine AS frontend-builder

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci --no-audit --no-fund

COPY . .

RUN npm run build


# Stage 2: Production runtime
FROM node:24-alpine

WORKDIR /app

RUN npm install -g serve

COPY --from=frontend-builder /app/dist ./dist

EXPOSE 8080

ENV NODE_ENV=production
ENV PORT=8080

CMD ["serve", "-s", "dist", "-l", "8080"]