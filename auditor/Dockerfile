FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    wget \
    unzip \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install IfcConvert binary
RUN wget https://github.com/IfcOpenShell/IfcOpenShell/releases/download/ifcconvert-0.8.4/ifcconvert-0.8.4-linux64.zip \
    && unzip ifcconvert-0.8.4-linux64.zip \
    && mv IfcConvert /usr/local/bin/IfcConvert \
    && chmod +x /usr/local/bin/IfcConvert \
    && rm ifcconvert-0.8.4-linux64.zip

# Install Python dependencies
COPY auditor/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY auditor/ .

# Install Node.js and build React frontend
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

COPY frontend/ /frontend
WORKDIR /frontend
RUN npm install
RUN VITE_API_MODE=flask npm run build -- --base=/

WORKDIR /app

EXPOSE 5000

CMD ["python", "app/server.py"]