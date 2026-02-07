FROM python:3.12.3-slim-bookworm

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir uv ddtrace

COPY pyproject.toml uv.lock ./

RUN uv sync --locked

RUN uv run crawl4ai-setup

COPY . .

ENV PATH="/app/.venv/bin:$PATH"
ARG DD_GIT_REPOSITORY_URL
ARG DD_GIT_COMMIT_SHA
ENV DD_GIT_REPOSITORY_URL=${DD_GIT_REPOSITORY_URL}
ENV DD_GIT_COMMIT_SHA=${DD_GIT_COMMIT_SHA}

CMD ["ddtrace-run", "python", "/app/main.py"]
