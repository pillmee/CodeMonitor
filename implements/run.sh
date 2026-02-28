#!/bin/bash

# ==========================================
# CodeMonitor Run Script
# ==========================================

# Function to handle graceful shutdown
cleanup() {
    echo ""
    echo "Shutting down CodeMonitor..."
    
    if [ -n "$FRONTEND_PID" ]; then
        echo "Stopping frontend server (PID: $FRONTEND_PID)..."
        kill $FRONTEND_PID 2>/dev/null
    fi
    
    if [ -n "$BACKEND_PID" ]; then
        echo "Stopping backend server (PID: $BACKEND_PID)..."
        kill $BACKEND_PID 2>/dev/null
    fi
    
    echo "CodeMonitor stopped."
    exit 0
}

# Default ports
BACKEND_PORT=8000
FRONTEND_PORT=5173

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --backend-port)
            BACKEND_PORT="$2"
            shift 2
            ;;
        --frontend-port)
            FRONTEND_PORT="$2"
            shift 2
            ;;
        *)
            echo "Unknown option: $1"
            echo "Usage: ./run.sh [--backend-port PORT] [--frontend-port PORT]"
            exit 1
            ;;
    esac
done

# Trap SIGINT (Ctrl+C) and SIGTERM
trap cleanup SIGINT SIGTERM

# 0. Check inotify limit on Linux
if [ "$(uname)" == "Linux" ]; then
    WATCH_LIMIT=$(cat /proc/sys/fs/inotify/max_user_watches 2>/dev/null || echo 0)
    if [ "$WATCH_LIMIT" -lt 524288 ] && [ "$WATCH_LIMIT" -ne 0 ]; then
        echo "Error: Linux file watcher limit ($WATCH_LIMIT) is too low for Vite."
        echo "To fix this, run the following command and restart your terminal:"
        echo "  echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf && sudo sysctl -p"
        exit 1
    fi
fi

# Function to check and free port
check_and_free_port() {
    local port=$1
    local name=$2
    # Check if port is in use
    PID=$(lsof -ti :$port 2>/dev/null)
    if [ -n "$PID" ]; then
        echo "Port $port ($name) is already in use by PID $PID."
        echo "Attempting to stop the existing process..."
        kill -9 $PID 2>/dev/null
        sleep 1
    fi
}

echo "Pre-run check: verifying ports..."
check_and_free_port $BACKEND_PORT "Backend"
check_and_free_port $FRONTEND_PORT "Frontend"

echo "Starting CodeMonitor Backend (FastAPI on port $BACKEND_PORT)..."
# Start backend in the background
if [ ! -f "venv/bin/python3" ]; then
    echo "Error: Virtual environment not found. Please run ./setup.sh first."
    exit 1
fi

(
    cd backend || exit
    PORT=$BACKEND_PORT ../venv/bin/python3 api/main.py &
    echo $! > ../.backend.pid
)
BACKEND_PID=$(cat .backend.pid 2>/dev/null)
rm .backend.pid 2>/dev/null

echo "Starting CodeMonitor Frontend (Vite on port $FRONTEND_PORT)..."
if [ -d "frontend" ]; then
    cd frontend
    npm run dev -- --port $FRONTEND_PORT &
    FRONTEND_PID=$!
    cd ..
else
    echo "Error: 'frontend' directory not found."
    cleanup
}

echo "=========================================="
echo "CodeMonitor is running!"
echo "Backend API:  http://127.0.0.1:$BACKEND_PORT"
echo "Frontend UI:  http://127.0.0.1:$FRONTEND_PORT"
echo "Press Ctrl+C to stop all servers."
echo "=========================================="

# Wait indefinitely until interrupted
wait
