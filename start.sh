#!/bin/bash

# Chess Game Startup Script

echo "🏁 Starting Chess Game..."

# Check if Go is installed
if ! command -v go &> /dev/null; then
    echo "❌ Go is not installed. Please install Go first."
    exit 1
fi

# Set default environment variables
export PORT=${PORT:-8080}
export USE_CHESS_API=${USE_CHESS_API:-true}  # Default to Chess-API.com
export STOCKFISH_PATH=${STOCKFISH_PATH:-/usr/local/bin/stockfish}
export CHESS_API_URL=${CHESS_API_URL:-https://chess-api.com/v1}

echo "🔧 Configuration:"
echo "   Port: $PORT"
echo "   Use Chess API: $USE_CHESS_API"

echo "   Chess API URL: $CHESS_API_URL"
echo "🌐 Using Chess-API.com (requires internet connection)"
echo "✅ No local Stockfish installation required!"

# Download dependencies if needed
if [ ! -d "vendor" ] && [ ! -f "go.sum" ]; then
    echo "📦 Downloading dependencies..."
    go mod download
fi

echo ""
echo "🚀 Starting server on http://localhost:$PORT"
echo "📝 API documentation: http://localhost:$PORT/api/health"
echo "🎮 Game interface: http://localhost:$PORT"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

# Start the application
go run main.go
