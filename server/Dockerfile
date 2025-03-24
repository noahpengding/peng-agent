FROM python:3.12.8-slim-bullseye

WORKDIR /app

COPY pyproject.toml uv.lock ./

RUN pip install --no-cache-dir uv>=0.6.6
RUN uv venv .venv && uv pip install .

COPY . .

CMD ["uv", "run", "/app/main.py"]
