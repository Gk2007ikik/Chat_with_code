# Cloud Run injects a PORT env var (default 8080) that the container must
# listen on - this is handled in the CMD line below via a shell so $PORT
# expands correctly at container start (not at build time).

FROM python:3.12-slim

# git is required at runtime: ingest.py shells out to the system `git`
# binary to clone repos, it's not a Python package.
RUN apt-get update && apt-get install -y --no-install-recommends git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Cloud Run sets PORT itself; 8080 here is just a sane local default.
ENV PORT=8080
EXPOSE 8080

CMD exec uvicorn api:app --host 0.0.0.0 --port ${PORT}
