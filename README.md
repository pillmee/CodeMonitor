# CodeMonitor

CodeMonitor is a powerful tool designed to monitor Git repository activity and visualize Lines of Code (LOC) growth and history across multiple projects. It provides a real-time dashboard for analyzing development trends.

## Features

- **Multi-Repository Tracking**: Monitor multiple Git repositories simultaneously.
- **Historical LOC Analysis**: Visualize how your codebase has grown over time.
- **Automated Backfill**: Automatically analyzes past commits to build a full history.
- **FastAPI Backend**: High-performance asynchronous API for data management.
- **Vite/React Frontend**: Modern, responsive dashboard for data visualization.

## Prerequisites

- **OS**: macOS or Linux (Ubuntu/Debian recommended)
- **Git**: Required for repository analysis.
- **Python**: 3.10 or higher.
- **Node.js**: 18 or higher.
- **cloc**: Required for counting lines of code.

## Installation & Setup

Navigate to the `implements` directory and run the setup script:

```bash
cd implements
./setup.sh
```

The script will:
1. Check for system dependencies (and attempt to upgrade Node.js on Linux if needed).
2. Create a Python virtual environment and install dependencies.
3. Install Frontend Node.js dependencies.

> [!TIP]
> On Linux, if you encounter `ENOSPC` errors during startup, run:
> `echo fs.inotify.max_user_watches=524288 | sudo tee -a /etc/sysctl.conf && sudo sysctl -p`

## Running CodeMonitor

Use the `run.sh` script to start both backend and frontend servers:

```bash
cd implements
./run.sh
```

### Options

You can specify custom ports for the servers:

```bash
./run.sh -b 8080 -f 3000
```

- `-b`, `--bp`, `--backend-port`: Set the Backend API port (default: 8000).
- `-f`, `--fp`, `--frontend-port`: Set the Frontend UI port (default: 5173).

## Project Structure

- `implements/backend`: FastAPI application and Git analysis logic.
- `implements/frontend`: Vite-based React application for the dashboard.
- `implements/setup.sh`: Cross-platform initialization script.
- `implements/run.sh`: Unified server management script.

## License

MIT License
