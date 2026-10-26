FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
FROM node:24-bookworm-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY server.mjs database.mjs hosting.mjs organizations.mjs invoices.mjs auth.mjs exports.mjs zip.mjs quote-math.mjs pdf-font.mjs logo.mjs imports.mjs imports-devis.mjs theme.mjs ./
COPY scripts ./scripts
COPY vendor ./vendor
COPY templates ./templates
COPY src/translations.mjs ./src/translations.mjs
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
EXPOSE 3000
CMD ["node","server.mjs"]
