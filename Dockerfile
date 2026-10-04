# Production Dockerfile for ShuttleTrack
FROM node:22-alpine AS build

WORKDIR /app

# Copy package definitions
COPY package*.json ./
COPY client/package*.json ./client/
COPY server/package*.json ./server/

# Install dependencies
RUN npm install
RUN cd client && npm install --include=dev
RUN cd server && npm install

# Copy application code
COPY . .

# Build Vite React client
RUN cd client && npm run build

# Production Runner stage
FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV EMAIL_USER=cleancodeuniverse@gmail.com
ENV EMAIL_PASSWORD=cetikgbausymfhnj
ENV EMAIL_HOST=smtp.gmail.com
ENV EMAIL_PORT=587
ENV EMAIL_SECURE=false
ENV EMAIL_SERVICE=gmail

COPY --from=build /app/server ./server
COPY --from=build /app/client/dist ./client/dist

WORKDIR /app/server
EXPOSE 5000

CMD ["node", "src/server.js"]
