#!/bin/bash

# Ensure we are in the backend directory
cd "$(dirname "$0")/.."

# Logic to handle venv in /tmp due to path issues with ":"
VENV_PATH="venv"
REAL_VENV_PATH="/tmp/stock_pl_venv"

# Ensure venv symlink exists and points to /tmp
if [ ! -L "$VENV_PATH" ] && [ ! -d "$VENV_PATH" ]; then
    echo "Creating venv symlink to $REAL_VENV_PATH..."
    ln -s "$REAL_VENV_PATH" "$VENV_PATH"
fi

if [ -L "$VENV_PATH" ] && [ ! -d "$VENV_PATH" ]; then
     echo "Recreating directory for symlinked venv..."
     # The directory at target might be missing
fi

# Ensure real venv exists and is populated
if [ ! -d "$REAL_VENV_PATH" ]; then
    echo "Creating virtual environment in $REAL_VENV_PATH..."
    python3 -m venv "$REAL_VENV_PATH"
    echo "Installing dependencies..."
    "$REAL_VENV_PATH/bin/pip" install --upgrade pip
    "$REAL_VENV_PATH/bin/pip" install -r requirements.txt
fi

# Run uvicorn with reload
echo "🚀 Starting FastAPI server on http://localhost:3001..."

if [ -f "$VENV_PATH/bin/uvicorn" ]; then
    ./$VENV_PATH/bin/uvicorn app.main:app --reload --port 3001 --host 0.0.0.0
else
    uvicorn app.main:app --reload --port 3001 --host 0.0.0.0
fi
