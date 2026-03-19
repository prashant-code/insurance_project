FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Nginx alpine server for tiny footprint
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
