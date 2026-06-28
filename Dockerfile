FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package.json ./
RUN npm install --omit=dev

# Copy source
COPY src/ ./src/

# Data directory (will be mounted as a volume)
RUN mkdir -p /data

ENV DATA_DIR=/data

CMD ["node", "src/index.js"]
