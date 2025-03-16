FROM python:3.12.8-slim-bullseye

WORKDIR /app

COPY pyproject.toml uv.lock ./

RUN pip install uv
RUN uv venv .venv && uv pip install .

COPY . .

CMD ["uv", "run", "/app/main.py"]
