#!/bin/bash

# ==========================================
# CodeMonitor Setup Script
# ==========================================

echo "Starting CodeMonitor setup..."

# 1. Install system dependencies
echo "[1/4] Checking system dependencies..."

OS_TYPE="$(uname)"
# Check cloc
if ! command -v cloc &> /dev/null; then
    echo "cloc could not be found. Attempting to install..."
    if [ "$OS_TYPE" == "Darwin" ]; then
        if command -v brew &> /dev/null; then
            brew install cloc
        else
            echo "Error: Homebrew not found. Please install Homebrew or cloc manually."
            exit 1
        fi
    elif [ "$OS_TYPE" == "Linux" ]; then
        if command -v apt-get &> /dev/null; then
            sudo apt-get update && sudo apt-get install -y cloc
        else
            echo "Error: apt-get not found. Please install cloc manually for your Linux distribution."
            exit 1
        fi
    else
        echo "Error: Unsupported OS ($OS_TYPE). Please install cloc manually."
        exit 1
    fi
else
    echo "cloc is already installed."
fi

# Check npm
if ! command -v npm &> /dev/null; then
    echo "Error: npm could not be found. Please install Node.js and npm before running this setup."
    exit 1
else
    echo "npm is already installed."
fi

# 2. Setup Python Backend Environment
echo "[2/4] Setting up Python virtual environment..."
if [ ! -d "venv" ]; then
    python3 -m venv venv
    echo "Created virtual environment 'venv'."
fi

echo "Installing backend requirements..."
# Update pip directly using venv path to avoid deactivate issues
./venv/bin/pip install --upgrade pip
if [ -f "requirements.txt" ]; then
    ./venv/bin/pip install -r requirements.txt
else
    # Fallback if requirements.txt is missing
    ./venv/bin/pip install fastapi uvicorn requests pytest GitPython pydantic sqlalchemy
fi
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
