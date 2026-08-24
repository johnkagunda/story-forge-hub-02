# Stage 1: Build frontend
FROM node:24-alpine AS frontend-builder

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci --no-audit --no-fund

COPY frontend/ ./frontend/

WORKDIR /app/frontend

RUN npx vite build


# Stage 2: Frontend runtime
FROM node:24-alpine

WORKDIR /app

RUN npm install -g serve

COPY --from=frontend-builder /app/frontend/dist ./dist

EXPOSE 8080

ENV NODE_ENV=production
ENV PORT=8080

CMD ["serve", "-s", "dist", "-l", "8080"]