FROM python:3.12.8-slim-bullseye

WORKDIR /

COPY requirements.txt /
RUN apt update && apt install -y git poppler-utils && apt-get clean
RUN pip install --no-cache-dir -r requirements.txt

COPY ./ /peng-bot

ENV TZ=America/Toronto

RUN apt-get update && apt-get install -y tzdata && \
    ln -fs /usr/share/zoneinfo/$TZ /etc/localtime && \
    dpkg-reconfigure -f noninteractive tzdata && \
    apt-get clean

CMD ["python", "/peng-bot/main.py"]
