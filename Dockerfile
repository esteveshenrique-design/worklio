FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
FROM node:24-bookworm-slim
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY server.mjs invoices.mjs auth.mjs exports.mjs zip.mjs quote-math.mjs pdf-font.mjs logo.mjs imports.mjs theme.mjs ./
COPY vendor ./vendor
COPY templates ./templates
COPY src/translations.mjs ./src/translations.mjs
ENV HOST=0.0.0.0 PORT=3000 DATA_DIR=/data
EXPOSE 3000
CMD ["node","server.mjs"]
