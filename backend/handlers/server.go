package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"chess-game/backend/services"
)

// Server represents the main HTTP server
type Server struct {
	gameService *services.GameService
	p2pService  *services.P2PService
	wsServer    *services.WebSocketServer
	staticDir   string
	port        string
}

// NewServer creates a new server instance
func NewServer(staticDir string, port string) (*Server, error) {
	ctx := context.Background()

	// Initialize services
	gameService := services.NewGameService()

	p2pService, err := services.NewP2PService(ctx, gameService)
	if err != nil {
		return nil, fmt.Errorf("failed to create P2P service: %w", err)
	}

	wsServer := services.NewWebSocketServer(gameService, p2pService)

	// Start cleanup routine
	gameService.StartCleanupRoutine()

	return &Server{
		gameService: gameService,
		p2pService:  p2pService,
		wsServer:    wsServer,
		staticDir:   staticDir,
		port:        port,
	}, nil
}

// Start starts the HTTP server
func (s *Server) Start() error {
	// Set up API routes first (more specific)
	http.HandleFunc("/ws", s.wsServer.HandleWebSocket)
	http.HandleFunc("/api/stats", s.handleStats)
	http.HandleFunc("/api/games", s.handleGames)
	http.HandleFunc("/api/peers", s.handlePeers)
	http.HandleFunc("/api/health", s.handleHealth)

	// Serve static files from root (CSS, JS, etc.)
	fs := http.FileServer(http.Dir(s.staticDir))
	http.Handle("/", fs)

	log.Printf("🌐 WebSocket server listening on :%s", s.port)
	log.Printf("🎮 Open http://localhost:%s to play!", s.port)

	return http.ListenAndServe(":"+s.port, nil)
}

// handleStats returns server statistics
func (s *Server) handleStats(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	stats := map[string]interface{}{
		"server_time":     time.Now(),
		"peer_id":         s.p2pService.GetHostID().String(),
		"connected_peers": len(s.p2pService.GetConnectedPeers()),
		"game_stats":      s.gameService.GetGameStats(),
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(stats)
}

// handleGames returns active games
func (s *Server) handleGames(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	games := s.gameService.GetActiveGames()

	// Convert games to public format (without sensitive data)
	publicGames := make([]map[string]interface{}, len(games))
	for i, game := range games {
		publicGames[i] = map[string]interface{}{
			"id":            game.ID,
			"status":        game.Status,
			"player_count":  len(game.Players),
			"current_turn":  game.CurrentTurn,
			"created_at":    game.CreatedAt,
			"last_activity": game.LastActivity,
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"games": publicGames,
		"count": len(publicGames),
	})
}

// handlePeers returns connected peers
func (s *Server) handlePeers(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	peers := s.p2pService.GetConnectedPeers()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"peers":   peers,
		"count":   len(peers),
		"host_id": s.p2pService.GetHostID().String(),
	})
}

// handleHealth returns server health status
func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	health := map[string]interface{}{
		"status":         "healthy",
		"timestamp":      time.Now(),
		"uptime_seconds": time.Since(time.Now()).Seconds(), // This would be calculated properly in a real implementation
		"services": map[string]bool{
			"game_service": true,
			"p2p_service":  true,
			"ws_service":   true,
		},
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(health)
}

// Close gracefully shuts down the server
func (s *Server) Close() error {
	log.Println("🛑 Shutting down server...")

	if err := s.p2pService.Close(); err != nil {
		log.Printf("Error closing P2P service: %v", err)
	}

	log.Println("✅ Server shutdown complete")
	return nil
}
