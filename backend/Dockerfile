FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S tracker && adduser -S tracker -G tracker
COPY package.json package-lock.json* ./
RUN npm install --omit=dev
COPY --from=build /app/dist ./dist
COPY migrations ./migrations
RUN mkdir -p /app/data/screenshots && chown -R tracker:tracker /app/data
VOLUME ["/app/data/screenshots"]
USER tracker
EXPOSE 3000
CMD ["node", "dist/server.js"]
