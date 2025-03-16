#!/bin/ash
# Replace API_BASE_URL in config.js
API_BASE_URL_VALUE=${VITE_BACKEND_URL:-"http://localhost:3000"}
sed -i "s|RUNTIME_API_BASE_URL_PLACEHOLDER|$API_BASE_URL_VALUE|g" /usr/share/nginx/html/config.js

nginx -g "daemon off;"