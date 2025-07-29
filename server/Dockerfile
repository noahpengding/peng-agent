FROM python:3.12.3-slim-bookworm

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir playwright

RUN playwright install chromium

RUN playwright install-deps

RUN pip uninstall -y playwright

RUN pip install --no-cache-dir uv

COPY pyproject.toml uv.lock ./

RUN uv sync --locked

COPY . .

ENV PATH="/app/.venv/bin:$PATH"

CMD ["uv", "run", "--active", "/app/main.py"]
