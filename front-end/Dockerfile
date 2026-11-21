FROM node:22-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install --ignore-scripts

COPY . .

EXPOSE 8081

CMD ["npx", "expo", "start", "--host", "lan"]