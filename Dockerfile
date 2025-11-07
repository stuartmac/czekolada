# Build stage
FROM node:18-alpine AS build

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (need all deps for build)
RUN npm ci && npm cache clean --force

# Copy source code
COPY . .

# Build the app
RUN npm run build

# Production stage
FROM nginx:alpine

# Install envsubst for environment variable substitution
RUN apk add --no-cache gettext

# Copy built assets from build stage
COPY --from=build /app/build /usr/share/nginx/html

# Copy nginx configuration template
COPY nginx.conf /etc/nginx/templates/default.conf.template

# Set default SLIVKA_URL (can be overridden at runtime)
# Note: Should NOT include /api/ suffix
ENV SLIVKA_URL=https://www.compbio.dundee.ac.uk/slivka

# Expose port 80
EXPOSE 80

# Use a shell script to substitute env vars and start nginx
CMD ["/bin/sh", "-c", "envsubst '${SLIVKA_URL}' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"]
