# Railway-optimized Dockerfile
FROM golang:1.21-alpine AS builder

# Install dependencies
RUN apk add --no-cache git ca-certificates

# Set working directory
WORKDIR /app

# Copy go mod files
COPY go.mod go.sum ./

# Download dependencies
RUN go mod download

# Copy source code
COPY . .

# Build the application
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o chess-game .

# Final stage
FROM alpine:latest

# Install ca-certificates for HTTPS requests
RUN apk --no-cache add ca-certificates

WORKDIR /root/

# Copy the binary and static files
COPY --from=builder /app/chess-game .
COPY --from=builder /app/index.html .
COPY --from=builder /app/frontend.js .
COPY --from=builder /app/chess.js .
COPY --from=builder /app/styles.css .

# Expose port
EXPOSE 8080

# Set environment variables
ENV PORT=8080
ENV USE_CHESS_API=true
ENV CHESS_API_URL=https://chess-api.com/v1
ENV GIN_MODE=release

# Run the application
CMD ["./chess-game"]