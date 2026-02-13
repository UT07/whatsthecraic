FROM python:3.11-slim

WORKDIR /app

# Healthcheck uses curl in docker-compose; install it in the runtime image.
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY src/ ./src/
COPY models/ ./models/

# Create directories for model artifacts
RUN mkdir -p /app/models /app/data

EXPOSE 4004

CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "4004"]
