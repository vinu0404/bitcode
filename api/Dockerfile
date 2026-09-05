FROM python:3.12-slim

# iverilog must be installed before the USER switch below, or HF Spaces
# (which forces a non-root user) fails to reach it at runtime.
RUN apt-get update && apt-get install -y --no-install-recommends \
      iverilog \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN useradd -m -u 1000 user && chown -R user /app
USER user
ENV HOME=/home/user

EXPOSE 7860

CMD ["sh", "-c", "alembic upgrade head && python -m app.seed.seed && uvicorn app.main:app --host 0.0.0.0 --port 7860"]
