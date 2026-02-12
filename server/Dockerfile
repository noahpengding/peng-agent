FROM dhi.io/python:3.12-debian13-sfw-dev AS builder

WORKDIR /app

COPY . .

RUN pip install --no-cache-dir uv
RUN uv venv --python python3.12 --no-cache /app/.venv
RUN uv sync --locked

FROM dhi.io/python:3.12

WORKDIR /app

ENV PATH="/app/.venv/bin:${PATH}"

COPY --from=builder /app /app

ARG DD_GIT_REPOSITORY_URL
ARG DD_GIT_COMMIT_SHA
ENV DD_GIT_REPOSITORY_URL=${DD_GIT_REPOSITORY_URL}
ENV DD_GIT_COMMIT_SHA=${DD_GIT_COMMIT_SHA}

CMD ["ddtrace-run", "python", "/app/main.py"]
