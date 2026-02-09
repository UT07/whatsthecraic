FROM node:18-alpine
RUN apk add --no-cache bash
WORKDIR /app
COPY package*.json ./
RUN npm install --production

COPY . .
EXPOSE 4001

CMD ["node", "index.js"]
