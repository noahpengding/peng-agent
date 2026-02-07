# Use the official Bun image as the base
FROM oven/bun:latest AS builder

# Set the working directory to the monorepo root
WORKDIR /app

# Copy shared module
COPY app/shared ./app/shared

# Copy web app config
COPY app/web/package.json app/web/bun.lock app/web/tsconfig.* app/web/vite.config.* app/web/tailwind.config.js app/web/postcss.config.js app/web/eslint.* ./app/web/

# Install dependencies for web (this will also resolve the local shared dependency)
WORKDIR /app/app/web
RUN bun install

# Copy the rest of the web application
COPY app/web ./

# Build the Vite app
RUN bun run build

# Use a lightweight server for the final image
FROM nginx:alpine

# Install bash and envsubst
RUN apk add --no-cache bash gettext

# Remove default Nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy custom Nginx config
COPY app/web/nginx.conf /etc/nginx/conf.d/

# Set working directory
WORKDIR /usr/share/nginx/html

# Remove default Nginx static files
RUN rm -rf ./*

# Copy build output from the builder stage
COPY --from=builder /app/app/web/dist ./

# Create startup script - make sure the path is correct
COPY app/web/docker-entrypoint.sh /docker-entrypoint.sh

# Make sure the script is executable and in the right place
RUN chmod +x /docker-entrypoint.sh

# Expose port 80
EXPOSE 80

# Start with our custom entrypoint
CMD ["/docker-entrypoint.sh"]
