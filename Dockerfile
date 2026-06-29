FROM node:20-alpine

WORKDIR /app

# Provide timezone database so TZ env is respected by OS-level time utilities.
RUN apk add --no-cache tzdata

# Install dependencies
COPY package.json ./
RUN npm install --omit=dev

# Copy source
COPY src/ ./src/

# Copy entrypoint that applies TZ/TIMEZONE to the container OS clock.
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Data directory (will be mounted as a volume)
RUN mkdir -p /data

ENV DATA_DIR=/data

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]

CMD ["node", "src/index.js"]
