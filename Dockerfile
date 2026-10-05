FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY packages/server/package.json packages/server/package.json
COPY packages/client/package.json packages/client/package.json
RUN npm ci
COPY . .
ARG CYBERANTE_BASE_PATH=/
ENV CYBERANTE_BASE_PATH=${CYBERANTE_BASE_PATH}
RUN npm run build && npm run verify:build && npm prune --omit=dev

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production PORT=8080
WORKDIR /app
COPY --from=build --chown=node:node /app/package.json /app/package-lock.json ./
COPY --from=build --chown=node:node /app/LICENSE /app/THIRD_PARTY_NOTICES.txt ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=build --chown=node:node /app/packages/shared/dist ./packages/shared/dist
COPY --from=build --chown=node:node /app/packages/server/package.json ./packages/server/package.json
COPY --from=build --chown=node:node /app/packages/server/dist ./packages/server/dist
COPY --from=build --chown=node:node /app/packages/client/package.json ./packages/client/package.json
COPY --from=build --chown=node:node /app/packages/client/dist ./packages/client/dist
USER node
EXPOSE 8080
CMD ["node", "packages/server/dist/index.js"]
