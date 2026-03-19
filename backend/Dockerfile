FROM node:20-alpine AS builder
ARG NODE_ENV=production
ENV NODE_ENV=$NODE_ENV
WORKDIR /app
COPY package*.json ./
RUN npm install

COPY . .

# Obfuscate the proprietary code to heavily protect intellectual property
RUN npm install -g javascript-obfuscator
RUN javascript-obfuscator ./ --output ./dist --exclude node_modules --compact true --control-flow-flattening true --target node

# Copy required runtime configurations to the output directory
RUN cp package.json ./dist/
RUN cp package-lock.json ./dist/
RUN cp .env* ./dist/ || true

# Prune dev dependencies so only production modules run
RUN npm prune --production
RUN cp -R node_modules ./dist/

# Final lightweight production stage
FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist /app

ENV NODE_ENV=production

EXPOSE 3000
CMD ["npm", "start"]
