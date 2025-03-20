FROM --platform=linux/amd64 node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production

COPY . .
RUN chmod +x /usr/local/bin/docker-entrypoint.sh
EXPOSE 4000


CMD ["node", "src/index.js"]