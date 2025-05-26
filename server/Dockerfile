FROM python:3.11.11-slim-bookworm

WORKDIR /app

RUN pip install --no-cache-dir uv>=0.6.6

COPY pyproject.toml uv.lock ./

RUN uv sync --locked

COPY . .

ENV PATH="/app/.venv/bin:$PATH"

CMD ["uv", "run", "--active", "/app/main.py"]
