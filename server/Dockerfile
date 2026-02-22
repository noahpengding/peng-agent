FROM dhi.io/python:3.12-debian13-sfw-dev AS builder

ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1
ENV LANG=C.UTF-8
ENV PATH="/app/.venv/bin:$PATH"

WORKDIR /app

COPY . .

RUN pip install --no-cache-dir uv
RUN uv venv --python python3.12 --no-cache /app/.venv
RUN uv sync --locked --no-cache --no-dev

FROM dhi.io/python:3.12

ARG DD_GIT_REPOSITORY_URL
ARG DD_GIT_COMMIT_SHA
ENV DD_GIT_REPOSITORY_URL=${DD_GIT_REPOSITORY_URL}
ENV DD_GIT_COMMIT_SHA=${DD_GIT_COMMIT_SHA}

ENV PYTHONUNBUFFERED=1
ENV PATH="/app/.venv/bin:$PATH"

WORKDIR /app

COPY --from=builder /app /app

CMD ["ddtrace-run", "python", "/app/main.py"]
