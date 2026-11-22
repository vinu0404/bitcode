FROM python:3.12-slim

# iverilog must be installed before the USER switch below, or HF Spaces
# (which forces a non-root user) fails to reach it at runtime.
RUN apt-get update && apt-get install -y --no-install-recommends \
      iverilog \
    && rm -rf /var/lib/apt/lists/* /var/cache/apt/*

# No .pyc files, unbuffered logs, and fewer glibc memory arenas: Python's
# default arenas waste a lot of RAM on a small server.
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    MALLOC_ARENA_MAX=2 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# Runtime dependencies only. Local development builds with INSTALL_DEV=true
# to add pytest (see docker-compose.yml); production images leave it out.
ARG INSTALL_DEV=false
COPY requirements.txt requirements-dev.txt ./
RUN --mount=type=cache,target=/root/.cache/pip \
    if [ "$INSTALL_DEV" = "true" ]; then pip install -r requirements-dev.txt; else pip install -r requirements.txt; fi

COPY . .

RUN useradd -m -u 1000 user && chown -R user /app
USER user
ENV HOME=/home/user

EXPOSE 7860

# exec, so uvicorn is PID 1 and receives stop signals; one worker keeps memory low.
CMD ["sh", "-c", "alembic upgrade head && python -m app.seed.seed && exec uvicorn app.main:app --host 0.0.0.0 --port 7860 --workers 1"]
