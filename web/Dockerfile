
# Use the official Bun image as the base
FROM oven/bun:latest AS builder

# Set the working directory
WORKDIR /app

# Copy package.json, bun.lockb, and vite config first (for better caching)
COPY package.json bun.lock tsconfig.* vite.config.* tailwind.config.js postcss.config.js eslint.* ./

# Install dependencies using Bun
RUN bun install --frozen-lockfile

# Copy the rest of the application
COPY . .

# Build the Vite app
RUN bun run build

# Use a lightweight server for the final image
FROM nginx:alpine

# Install bash and envsubst
RUN apk add --no-cache bash gettext

# Remove default Nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy custom Nginx config
COPY nginx.conf /etc/nginx/conf.d/

# Set working directory
WORKDIR /usr/share/nginx/html

# Remove default Nginx static files
RUN rm -rf ./*

# Copy build output from the builder stage
COPY --from=builder /app/dist ./

# Create startup script - make sure the path is correct
COPY docker-entrypoint.sh /docker-entrypoint.sh

# Make sure the script is executable and in the right place
RUN chmod +x /docker-entrypoint.sh

# Expose port 80
EXPOSE 80

# Start with our custom entrypoint
CMD ["/docker-entrypoint.sh"]
