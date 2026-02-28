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

# Trap SIGINT (Ctrl+C) and SIGTERM
trap cleanup SIGINT SIGTERM

echo "Starting CodeMonitor Backend (FastAPI)..."
source venv/bin/activate
# Start backend in the background using python module execution to avoid relative path issues
cd backend
python3 api/main.py &
BACKEND_PID=$!
cd ..

echo "Starting CodeMonitor Frontend (Vite)..."
if [ -d "frontend" ]; then
    cd frontend
    npm run dev &
    FRONTEND_PID=$!
    cd ..
else
    echo "Error: 'frontend' directory not found."
    cleanup
fi

echo "=========================================="
echo "CodeMonitor is running!"
echo "Backend API:  http://127.0.0.1:8000"
echo "Frontend UI:  http://127.0.0.1:5173"
echo "Press Ctrl+C to stop all servers."
echo "=========================================="

# Wait indefinitely until interrupted
wait
