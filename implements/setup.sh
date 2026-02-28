#!/bin/bash

# ==========================================
# CodeMonitor Setup Script
# ==========================================

echo "Starting CodeMonitor setup..."

# 1. Install system dependencies (MacOS assumed)
echo "[1/4] Checking system dependencies..."
if ! command -v cloc &> /dev/null; then
    echo "cloc could not be found. Attempting to install via Homebrew..."
    if command -v brew &> /dev/null; then
        brew install cloc
    else
        echo "Error: Homebrew not found. Please install cloc manually (e.g., sudo apt install cloc on Linux)."
        exit 1
    fi
else
    echo "cloc is already installed."
fi

# 2. Setup Python Backend Environment
echo "[2/4] Setting up Python virtual environment..."
if [ ! -d "venv" ]; then
    python3 -m venv venv
    echo "Created virtual environment 'venv'."
fi

echo "Activating virtual environment and installing backend requirements..."
source venv/bin/activate
pip install --upgrade pip
if [ -f "requirements.txt" ]; then
    pip install -r requirements.txt
else
    # Fallback if requirements.txt is missing
    pip install fastapi uvicorn requests pytest GitPython pydantic sqlalchemy
fi
deactivate
echo "Backend environment setup complete."

# 3. Setup Node Frontend Environment
echo "[3/4] Setting up Node frontend environment..."
if [ -d "frontend" ]; then
    cd frontend
    npm install
    cd ..
    echo "Frontend dependencies installed."
else
    echo "Warning: 'frontend' directory not found. Make sure you are running this from the 'implements' directory."
fi

echo "[4/4] Setup completed successfully!"
echo "You can now run the application using: ./run.sh"
