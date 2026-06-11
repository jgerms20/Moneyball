# Trader Mirror — single-user, self-hosted.
# Build:  docker build -t trader-mirror .
# Run:    docker run -p 3000:3000 -v tm-data:/app/data \
#           -e TRADER_MIRROR_ACCESS_CODE=yourcode trader-mirror

FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-slim AS run
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app ./
VOLUME /app/data
EXPOSE 3000
CMD ["npm", "start"]
