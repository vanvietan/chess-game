# Chess Game Makefile

.PHONY: help build run test clean docker-build docker-run docker-stop setup-dev

# Default target
help:
	@echo "Available commands:"
	@echo "  setup-dev       - Set up development environment"
	@echo "  build           - Build the Go application"
	@echo "  run             - Run with Chess-API.com (default)"
	@echo "  run-stockfish   - Run with local Stockfish (optional)"
	@echo "  test            - Run tests"
	@echo "  clean           - Clean build artifacts"
	@echo "  docker-build    - Build Docker image"
	@echo "  docker-run      - Run with Docker Compose"
	@echo "  docker-simple   - Run simplified Chess-API.com only version"
	@echo "  docker-stop     - Stop Docker containers"

# Development setup
setup-dev:
	@echo "Setting up development environment..."
	go mod download
	@echo "Development setup complete!"

# Build the application
build:
	@echo "Building Go application..."
	go build -o bin/chess-game main.go
	@echo "Build complete!"

# Run locally with Chess-API.com (default)
run:
	@echo "Starting chess game with Chess-API.com..."
	@export USE_CHESS_API=true && \
	export CHESS_API_URL=https://chess-api.com/v1 && \
	export PORT=8080 && \
	go run main.go

# Run locally with Stockfish (optional)
run-stockfish:
	@echo "Starting chess game with local Stockfish..."
	@export USE_CHESS_API=false && \
	export STOCKFISH_PATH=/usr/local/bin/stockfish && \
	export PORT=8080 && \
	go run main.go

# Run tests
test:
	@echo "Running tests..."
	go test ./...

# Clean build artifacts
clean:
	@echo "Cleaning build artifacts..."
	rm -rf bin/
	go clean

# Docker commands
docker-build:
	@echo "Building Docker image..."
	docker build -t chess-game:latest .

docker-run:
	@echo "Starting Docker containers..."
	docker-compose up -d

docker-simple:
	@echo "Starting simplified Chess-API.com version..."
	docker-compose -f docker-compose-simple.yml up -d

docker-run-stockfish:
	@echo "Starting with Stockfish engine..."
	docker-compose up chess-game-stockfish -d

docker-run-api:
	@echo "Starting with Chess-API.com..."
	docker-compose up chess-game-api -d

docker-stop:
	@echo "Stopping Docker containers..."
	docker-compose down

# Development with live reload (requires air: go install github.com/cosmtrek/air@latest)
dev:
	@if command -v air > /dev/null; then \
		echo "Starting development server with live reload..."; \
		air; \
	else \
		echo "Installing air for live reload..."; \
		go install github.com/cosmtrek/air@latest; \
		air; \
	fi

# Format code
fmt:
	@echo "Formatting Go code..."
	go fmt ./...

# Lint code (requires golangci-lint)
lint:
	@if command -v golangci-lint > /dev/null; then \
		echo "Running linter..."; \
		golangci-lint run; \
	else \
		echo "golangci-lint not installed. Run: go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest"; \
	fi

# Install dependencies for development
install-dev-tools:
	@echo "Installing development tools..."
	go install github.com/cosmtrek/air@latest
	go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest
	@echo "Development tools installed!"

# Run with custom Stockfish path
run-custom-stockfish:
	@read -p "Enter Stockfish path: " path; \
	export USE_CHESS_API=false && \
	export STOCKFISH_PATH=$$path && \
	export PORT=8080 && \
	go run main.go

# Check if Stockfish is available
check-stockfish:
	@if command -v stockfish > /dev/null; then \
		echo "✅ Stockfish found at: $$(which stockfish)"; \
		stockfish --help | head -n 1; \
	else \
		echo "❌ Stockfish not found. Install with:"; \
		echo "  macOS: brew install stockfish"; \
		echo "  Ubuntu: sudo apt-get install stockfish"; \
	fi

# Health check
health:
	@echo "Checking application health..."
	@curl -s http://localhost:8080/api/health || echo "Application not running"

# Show application logs
logs:
	docker-compose logs -f

# Restart specific service
restart-stockfish:
	docker-compose restart chess-game-stockfish

restart-api:
	docker-compose restart chess-game-api
