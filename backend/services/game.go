package services

import (
	"fmt"
	"log"
	"sync"
	"time"

	"chess-game/backend/models"
)

// GameService handles chess game logic and state management
type GameService struct {
	games      map[string]*models.Game
	gamesMutex sync.RWMutex
	wsClients  map[string]*WSClient // WebSocket clients for frontend communication
	wsMutex    sync.RWMutex
}

// WSClient represents a WebSocket client connection
type WSClient struct {
	ID       string
	SendChan chan []byte
	PeerID   string
}

// NewGameService creates a new game service
func NewGameService() *GameService {
	return &GameService{
		games:     make(map[string]*models.Game),
		wsClients: make(map[string]*WSClient),
	}
}

// CreateGame creates a new chess game
func (gs *GameService) CreateGame(hostPeerID string, hostPlayerName string) (*models.Game, error) {
	gs.gamesMutex.Lock()
	defer gs.gamesMutex.Unlock()

	game := models.NewGame(hostPeerID, hostPlayerName)
	gs.games[game.ID] = game

	log.Printf("🎮 Created new game: %s (Host: %s)", game.ID, hostPlayerName)
	return game, nil
}

// JoinGame allows a player to join an existing game
func (gs *GameService) JoinGame(gameID string, peerID string, playerName string) (*models.Game, error) {
	gs.gamesMutex.Lock()
	defer gs.gamesMutex.Unlock()

	game, exists := gs.games[gameID]
	if !exists {
		return nil, fmt.Errorf("game not found")
	}

	if err := game.AddPlayer(peerID, playerName); err != nil {
		return nil, err
	}

	log.Printf("👤 Player %s joined game %s", playerName, gameID)
	return game, nil
}

// GetGame retrieves a game by ID
func (gs *GameService) GetGame(gameID string) *models.Game {
	gs.gamesMutex.RLock()
	defer gs.gamesMutex.RUnlock()

	return gs.games[gameID]
}

// GetGamesByPeer returns all games involving a specific peer
func (gs *GameService) GetGamesByPeer(peerID string) []*models.Game {
	gs.gamesMutex.RLock()
	defer gs.gamesMutex.RUnlock()

	var playerGames []*models.Game
	for _, game := range gs.games {
		for _, player := range game.Players {
			if player.PeerID == peerID {
				playerGames = append(playerGames, game)
				break
			}
		}
	}
	return playerGames
}

// UpdateGame updates an existing game
func (gs *GameService) UpdateGame(updatedGame *models.Game) {
	gs.gamesMutex.Lock()
	defer gs.gamesMutex.Unlock()

	gs.games[updatedGame.ID] = updatedGame
}

// ProcessMove processes a chess move and updates the game state
func (gs *GameService) ProcessMove(gameID string, move *models.Move) (*models.Game, error) {
	gs.gamesMutex.Lock()
	defer gs.gamesMutex.Unlock()

	game, exists := gs.games[gameID]
	if !exists {
		return nil, fmt.Errorf("game not found")
	}

	// Validate that the move is from a valid player
	player := game.GetPlayer(move.PlayerID)
	if player == nil {
		return nil, fmt.Errorf("player not found in game")
	}

	// Validate FEN format
	if !models.ValidateFEN(move.FEN) {
		return nil, fmt.Errorf("invalid FEN notation")
	}

	// Make the move
	if err := game.MakeMove(move); err != nil {
		return nil, err
	}

	log.Printf("♟️ Move processed: %s -> %s in game %s", move.From, move.To, gameID)
	return game, nil
}

// ResignGame handles player resignation
func (gs *GameService) ResignGame(gameID string, peerID string) (*models.Game, error) {
	gs.gamesMutex.Lock()
	defer gs.gamesMutex.Unlock()

	game, exists := gs.games[gameID]
	if !exists {
		return nil, fmt.Errorf("game not found")
	}

	player := game.GetPlayer(peerID)
	if player == nil {
		return nil, fmt.Errorf("player not found in game")
	}

	// End the game
	now := time.Now()
	game.Status = models.GameStatusFinished
	game.EndTime = &now

	// Determine winner (opponent of resigning player)
	if player.Color == "white" {
		result := models.GameResultBlackWins
		game.Result = &result
	} else {
		result := models.GameResultWhiteWins
		game.Result = &result
	}

	log.Printf("🏳️ Player %s resigned from game %s", player.Name, gameID)
	return game, nil
}

// DrawGame handles draw agreement
func (gs *GameService) DrawGame(gameID string) (*models.Game, error) {
	gs.gamesMutex.Lock()
	defer gs.gamesMutex.Unlock()

	game, exists := gs.games[gameID]
	if !exists {
		return nil, fmt.Errorf("game not found")
	}

	// End the game with draw result
	now := time.Now()
	game.Status = models.GameStatusFinished
	game.EndTime = &now
	result := models.GameResultDraw
	game.Result = &result

	log.Printf("🤝 Game %s ended in a draw", gameID)
	return game, nil
}

// AbandonGame handles game abandonment
func (gs *GameService) AbandonGame(gameID string, peerID string) (*models.Game, error) {
	gs.gamesMutex.Lock()
	defer gs.gamesMutex.Unlock()

	game, exists := gs.games[gameID]
	if !exists {
		return nil, fmt.Errorf("game not found")
	}

	// End the game
	now := time.Now()
	game.Status = models.GameStatusAbandoned
	game.EndTime = &now
	result := models.GameResultAbandoned
	game.Result = &result

	log.Printf("🚫 Game %s abandoned by peer %s", gameID, peerID)
	return game, nil
}

// GetAllGames returns all games
func (gs *GameService) GetAllGames() []*models.Game {
	gs.gamesMutex.RLock()
	defer gs.gamesMutex.RUnlock()

	var allGames []*models.Game
	for _, game := range gs.games {
		allGames = append(allGames, game)
	}
	return allGames
}

// GetActiveGames returns all active games
func (gs *GameService) GetActiveGames() []*models.Game {
	gs.gamesMutex.RLock()
	defer gs.gamesMutex.RUnlock()

	var activeGames []*models.Game
	for _, game := range gs.games {
		if game.Status == models.GameStatusActive || game.Status == models.GameStatusWaiting {
			activeGames = append(activeGames, game)
		}
	}
	return activeGames
}

// CleanupInactiveGames removes old inactive games
func (gs *GameService) CleanupInactiveGames(maxAge time.Duration) {
	gs.gamesMutex.Lock()
	defer gs.gamesMutex.Unlock()

	now := time.Now()
	var toDelete []string

	for gameID, game := range gs.games {
		// Remove finished games older than maxAge
		if game.Status == models.GameStatusFinished || game.Status == models.GameStatusAbandoned {
			if game.EndTime != nil && now.Sub(*game.EndTime) > maxAge {
				toDelete = append(toDelete, gameID)
			}
		}
		// Remove waiting games with no activity for more than maxAge
		if game.Status == models.GameStatusWaiting {
			if now.Sub(game.LastActivity) > maxAge {
				toDelete = append(toDelete, gameID)
			}
		}
	}

	for _, gameID := range toDelete {
		delete(gs.games, gameID)
		log.Printf("🗑️ Cleaned up inactive game: %s", gameID)
	}
}

// AddWSClient adds a WebSocket client for frontend communication
func (gs *GameService) AddWSClient(clientID string, client *WSClient) {
	gs.wsMutex.Lock()
	defer gs.wsMutex.Unlock()

	gs.wsClients[clientID] = client
	log.Printf("🔌 Added WebSocket client: %s", clientID)
}

// RemoveWSClient removes a WebSocket client
func (gs *GameService) RemoveWSClient(clientID string) {
	gs.wsMutex.Lock()
	defer gs.wsMutex.Unlock()

	delete(gs.wsClients, clientID)
	log.Printf("🔌 Removed WebSocket client: %s", clientID)
}

// NotifyFrontend sends a message to all connected frontend clients
func (gs *GameService) NotifyFrontend(messageType string, data map[string]interface{}) {
	gs.wsMutex.RLock()
	defer gs.wsMutex.RUnlock()

	message := models.NewWSMessage(models.MessageType(messageType))
	for key, value := range data {
		message.SetWSData(key, value)
	}

	msgBytes, err := message.ToWSJSON()
	if err != nil {
		log.Printf("Failed to marshal WebSocket message: %v", err)
		return
	}

	// Send to all connected clients
	for _, client := range gs.wsClients {
		select {
		case client.SendChan <- msgBytes:
			// Message sent successfully
		default:
			// Channel is full, skip this client
			log.Printf("⚠️ WebSocket client %s channel is full, skipping message", client.ID)
		}
	}
}

// NotifyClient sends a message to a specific frontend client
func (gs *GameService) NotifyClient(clientID string, messageType string, data map[string]interface{}) {
	gs.wsMutex.RLock()
	defer gs.wsMutex.RUnlock()

	client, exists := gs.wsClients[clientID]
	if !exists {
		log.Printf("⚠️ WebSocket client %s not found", clientID)
		return
	}

	message := models.NewWSMessage(models.MessageType(messageType))
	for key, value := range data {
		message.SetWSData(key, value)
	}

	msgBytes, err := message.ToWSJSON()
	if err != nil {
		log.Printf("Failed to marshal WebSocket message: %v", err)
		return
	}

	select {
	case client.SendChan <- msgBytes:
		// Message sent successfully
	default:
		// Channel is full
		log.Printf("⚠️ WebSocket client %s channel is full", clientID)
	}
}

// GetGameStats returns game statistics
func (gs *GameService) GetGameStats() map[string]interface{} {
	gs.gamesMutex.RLock()
	defer gs.gamesMutex.RUnlock()

	stats := map[string]interface{}{
		"total_games":    len(gs.games),
		"active_games":   0,
		"waiting_games":  0,
		"finished_games": 0,
		"total_players":  0,
		"online_players": 0,
	}

	playerSet := make(map[string]bool)
	onlinePlayerSet := make(map[string]bool)

	for _, game := range gs.games {
		switch game.Status {
		case models.GameStatusActive:
			stats["active_games"] = stats["active_games"].(int) + 1
		case models.GameStatusWaiting:
			stats["waiting_games"] = stats["waiting_games"].(int) + 1
		case models.GameStatusFinished, models.GameStatusAbandoned:
			stats["finished_games"] = stats["finished_games"].(int) + 1
		}

		for _, player := range game.Players {
			playerSet[player.PeerID] = true
			if player.IsOnline {
				onlinePlayerSet[player.PeerID] = true
			}
		}
	}

	stats["total_players"] = len(playerSet)
	stats["online_players"] = len(onlinePlayerSet)

	return stats
}

// StartCleanupRoutine starts a goroutine to periodically clean up inactive games
func (gs *GameService) StartCleanupRoutine() {
	go func() {
		ticker := time.NewTicker(5 * time.Minute) // Clean up every 5 minutes
		defer ticker.Stop()

		for range ticker.C {
			gs.CleanupInactiveGames(30 * time.Minute) // Remove games inactive for 30 minutes
		}
	}()
}
