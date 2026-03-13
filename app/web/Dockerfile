FROM dhi.io/bun:1-debian13-dev AS builder

WORKDIR /app

COPY app/share ./app/share
COPY app/web ./app/web

RUN cd app/share && bun install

RUN cd app/web && bun install

RUN cd app/web && bun run build

FROM dhi.io/nginx:1-debian13-dev


WORKDIR /usr/share/nginx/html

COPY --from=builder /app/app/web/dist ./
COPY --from=builder /app/app/web/nginx.conf /etc/nginx/conf.d/
COPY --from=builder /app/app/web/docker-entrypoint.sh /docker-entrypoint.sh

ARG DD_GIT_REPOSITORY_URL
ARG DD_GIT_COMMIT_SHA
ENV DD_GIT_REPOSITORY_URL=${DD_GIT_REPOSITORY_URL}
ENV DD_GIT_COMMIT_SHA=${DD_GIT_COMMIT_SHA}

ARG VERSION
ENV VITE_APP_VERSION=${VERSION}

EXPOSE 80

CMD ["sh", "/docker-entrypoint.sh"]
