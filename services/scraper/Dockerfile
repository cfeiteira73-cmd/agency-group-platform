FROM python:3.12-slim

WORKDIR /app

# System deps: gcc for some pip packages, libpq for supabase/psycopg, curl for healthchecks
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies first (layer cache optimisation)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install Playwright browser (chromium only — minimise image size)
RUN playwright install chromium --with-deps

# Copy application source
COPY . .

EXPOSE 8000

# Healthcheck (Docker native)
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

CMD ["uvicorn", "scraper.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
