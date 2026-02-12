FROM dhi.io/bun:1-debian13-dev AS builder

WORKDIR /app

COPY package.json bun.lock tsconfig.* vite.config.* tailwind.config.js postcss.config.js eslint.* ./

RUN bun install --frozen-lockfile

COPY . .

RUN bun run build

FROM dhi.io/nginx:1-debian13

COPY nginx.conf /etc/nginx/conf.d/

WORKDIR /usr/share/nginx/html

COPY --from=builder /app/dist ./
COPY --from=builder /app/docker-entrypoint.sh /docker-entrypoint.sh

ARG DD_GIT_REPOSITORY_URL
ARG DD_GIT_COMMIT_SHA
ENV DD_GIT_REPOSITORY_URL=${DD_GIT_REPOSITORY_URL}
ENV DD_GIT_COMMIT_SHA=${DD_GIT_COMMIT_SHA}

ARG VERSION
ENV VITE_APP_VERSION=${VERSION}

EXPOSE 80

CMD [ "/docker-entrypoint.sh" ]
