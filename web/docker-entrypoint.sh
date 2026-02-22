#!/bin/bash

# Default API URL if not provided
if [ -z "$VITE_BACKEND_URL" ]; then
  export API_BASE_URL="http://localhost:8080"
else
  # Make sure API_BASE_URL doesn't end with a slash
  export API_BASE_URL="${VITE_BACKEND_URL%/}"
fi

echo "Setting API proxy to: $API_BASE_URL"

# Replace environment variables in nginx.conf
envsubst '${API_BASE_URL}' < /etc/nginx/conf.d/nginx.conf > /etc/nginx/conf.d/default.conf
envsubst '${VITE_DATADOG_APPLICATION_ID} ${VITE_DATADOG_CLIENT_TOKEN} ${VITE_DATADOG_SITE} ${VITE_DATADOG_SERVICE} ${VITE_DATADOG_ENV} ${VITE_APP_VERSION}' < /usr/share/nginx/html/config.js > /usr/share/nginx/html/config.tmp.js

mv /usr/share/nginx/html/config.tmp.js /usr/share/nginx/html/config.js
rm /etc/nginx/conf.d/nginx.conf

# Start nginx in foreground
nginx -g 'daemon off;'