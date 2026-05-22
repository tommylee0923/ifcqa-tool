FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    wget \
    unzip \
    && rm -rf /var/lib/apt/lists/*

# Install IfcConvert binary
RUN wget https://github.com/IfcOpenShell/IfcOpenShell/releases/download/ifcconvert-0.8.4/ifcconvert-0.8.4-linux64.zip \
    && unzip ifcconvert-0.8.4-linux64.zip \
    && mv IfcConvert /usr/local/bin/IfcConvert \
    && chmod +x /usr/local/bin/IfcConvert \
    && rm ifcconvert-0.8.4-linux64.zip

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

EXPOSE 5000

CMD ["python", "app/server.py"]