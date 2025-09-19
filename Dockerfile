# Build stage
FROM golang:1.21-alpine AS builder

# Install build dependencies
RUN apk add --no-cache git

# Set working directory
WORKDIR /app

# Copy go mod files
COPY go.mod go.sum ./

# Download dependencies
RUN go mod download

# Copy source code
COPY . .

# Build the application
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o main .

# Final stage
FROM alpine:latest

# Install Stockfish and other dependencies
RUN apk --no-cache add stockfish ca-certificates

# Create non-root user
RUN adduser -D -s /bin/sh appuser

# Set working directory
WORKDIR /app

# Copy the binary from builder stage
COPY --from=builder /app/main .

# Copy static files
COPY --chown=appuser:appuser index.html .
COPY --chown=appuser:appuser frontend.js .
COPY --chown=appuser:appuser chess.js .
COPY --chown=appuser:appuser styles.css .

# Change ownership of the app directory
RUN chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 8080

# Set environment variables
ENV PORT=8080
ENV STOCKFISH_PATH=/usr/bin/stockfish
ENV USE_CHESS_API=false

# Run the application
CMD ["./main"]
