package main

import (
	"flag"
	"log"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"

	"chess-game/backend/handlers"
)

func main() {
	// Command line flags
	var (
		port      = flag.String("port", "8080", "HTTP server port")
		staticDir = flag.String("static", ".", "Static files directory")
	)
	flag.Parse()

	// Get absolute path for static directory
	absStaticDir, err := filepath.Abs(*staticDir)
	if err != nil {
		log.Fatalf("Failed to get absolute path for static directory: %v", err)
	}

	log.Println("🚀 Chess Server starting...")

	// Create and start server
	server, err := handlers.NewServer(absStaticDir, *port)
	if err != nil {
		log.Fatalf("Failed to create server: %v", err)
	}

	// Handle graceful shutdown
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	// Start server in a goroutine
	go func() {
		if err := server.Start(); err != nil {
			log.Fatalf("Server failed: %v", err)
		}
	}()

	// Wait for shutdown signal
	<-sigChan

	// Graceful shutdown
	if err := server.Close(); err != nil {
		log.Printf("Error during shutdown: %v", err)
	}
}
