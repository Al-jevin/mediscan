FROM python:3.11-slim

WORKDIR /workspace/back-end

# System libraries required by PaddleOCR / OpenCV and psycopg2
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libgl1 \
    libglib2.0-0 \
    libgomp1 \
    libsm6 \
    libxext6 \
    libxrender1 \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Ensure the static mount target for /crud-tester exists even outside Compose
RUN mkdir -p /workspace/front-end

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

CMD ["python", "-m", "uvicorn", "main:app", "--app-dir", "app", "--host", "0.0.0.0", "--port", "8000", "--reload"]