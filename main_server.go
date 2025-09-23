package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/vanvietannguyen/chess-game/internal/api"
	"github.com/vanvietannguyen/chess-game/internal/config"
	"github.com/vanvietannguyen/chess-game/internal/services"
)

func main() {
	// Load configuration
	cfg := config.Load()

	// Initialize services
	var chessEngine services.ChessEngine

	if cfg.UseChessAPI {
		log.Println("Using Chess-API.com for chess engine")
		chessEngine = services.NewChessAPIService(cfg.ChessAPIURL)
	} else {
		log.Println("Using local Stockfish engine")
		chessEngine = services.NewStockfishService(cfg.StockfishPath)
	}

	gameService := services.NewGameService(chessEngine)

	// Initialize Gin router
	r := gin.Default()

	// CORS middleware
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"*"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"*"},
		AllowCredentials: true,
	}))

	// Serve static files
	r.Static("/static", "./static")
	r.StaticFile("/", "./index.html")
	r.StaticFile("/frontend.js", "./frontend.js")
	r.StaticFile("/chess.js", "./chess.js")
	r.StaticFile("/styles.css", "./styles.css")

	// Initialize API routes
	api.SetupRoutes(r, gameService, chessEngine)

	// Create HTTP server
	srv := &http.Server{
		Addr:    ":" + cfg.Port,
		Handler: r,
	}

	// Start server in a goroutine
	go func() {
		log.Printf("Chess game server starting on port %s", cfg.Port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Failed to start server: %v", err)
		}
	}()

	// Wait for interrupt signal to gracefully shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("Shutting down server...")

	// Graceful shutdown with timeout
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Fatal("Server forced to shutdown:", err)
	}

	log.Println("Server exited")
}
