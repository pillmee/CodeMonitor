#!/bin/bash

# ==========================================
# CodeMonitor Setup Script
# ==========================================

echo "Starting CodeMonitor setup..."

# 1. Install system dependencies
echo "[1/4] Checking system dependencies..."

OS_TYPE="$(uname)"

# Function to install dependencies based on OS
install_dep() {
    local dep_name=$1
    local brew_pkg=$2
    local apt_pkg=$3

    if ! command -v "$dep_name" &> /dev/null; then
        echo "$dep_name could not be found. Attempting to install..."
        if [ "$OS_TYPE" == "Darwin" ]; then
            if command -v brew &> /dev/null; then
                brew install "$brew_pkg"
            else
                echo "Error: Homebrew not found. Please install Homebrew or $dep_name manually."
                exit 1
            fi
        elif [ "$OS_TYPE" == "Linux" ]; then
            if command -v apt-get &> /dev/null; then
                sudo apt-get update && sudo apt-get install -y "$apt_pkg"
            else
                echo "Error: apt-get not found. Please install $dep_name manually for your Linux distribution."
                exit 1
            fi
        else
            echo "Error: Unsupported OS ($OS_TYPE). Please install $dep_name manually."
            exit 1
        fi
    else
        echo "$dep_name is already installed."
    fi
}

# Check cloc
install_dep "cloc" "cloc" "cloc"

# Check node and npm
install_dep "node" "node" "nodejs"
install_dep "npm" "node" "npm"

# Verify Node.js version (Vite requires Node.js 18+ or 20+)
NODE_VERSION=$(node -v | cut -d'v' -f2)
NODE_MAJOR=$(echo "$NODE_VERSION" | cut -d'.' -f1)
if [ "$NODE_MAJOR" -lt 18 ]; then
    echo "Error: Node.js version $NODE_VERSION is too old. Vite requires Node.js 18 or higher."
    if [ "$OS_TYPE" == "Linux" ]; then
        echo "Tip: You can install a newer version using NodeSource or nvm:"
        echo "  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -"
        echo "  sudo apt-get install -y nodejs"
    fi
    exit 1
fi

# 2. Setup Python Backend Environment
echo "[2/4] Setting up Python virtual environment..."

# On Linux, python3-venv is often required
if [ "$OS_TYPE" == "Linux" ]; then
    if ! dpkg -l | grep -q "python3-venv"; then
        echo "python3-venv not found. Attempting to install..."
        sudo apt-get install -y python3-venv
    fi
fi

if [ ! -d "venv" ]; then
    python3 -m venv venv || { echo "Error: Failed to create virtual environment."; exit 1; }
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
