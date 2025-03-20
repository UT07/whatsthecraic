FROM --platform=linux/amd64 node:18-alpine
RUN apk add --no-cache bash
WORKDIR /app
COPY package*.json ./
RUN npm install --production

COPY . .
RUN chmod +x /usr/local/bin/docker-entrypoint.sh
EXPOSE 4001

CMD ["node", "index.js"]
