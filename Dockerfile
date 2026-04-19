# Stage 1: Build Next.js Frontend
FROM node:20 AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm install

COPY frontend/ ./
RUN npm run build

# Stage 2: Setup Python Backend and serve
FROM python:3.10-slim
WORKDIR /app

# Create a non-root user for Hugging Face Spaces
RUN useradd -m -u 1000 user
USER user
ENV HOME=/home/user \
	PATH=/home/user/.local/bin:$PATH

WORKDIR $HOME/app

COPY --chown=user backend/requirements.txt ./backend/
RUN pip install --no-cache-dir -r backend/requirements.txt

# Copy FastAPI backend
COPY --chown=user backend/ ./backend/

# Copy compiled Next.js frontend
COPY --chown=user --from=frontend-builder /app/frontend/out ./frontend/out

# Hugging Face Spaces runs on port 7860 by default
EXPOSE 7860

# Start the FastAPI application
CMD ["python", "backend/main.py"]
