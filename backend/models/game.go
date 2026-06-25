package models

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
)

// Player represents a chess player
type Player struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Color    string `json:"color"` // "white" or "black"
	PeerID   string `json:"peer_id"`
	IsOnline bool   `json:"is_online"`
}

// Move represents a chess move
type Move struct {
	ID          string    `json:"id"`
	GameID      string    `json:"game_id"`
	PlayerID    string    `json:"player_id"`
	From        string    `json:"from"`      // e.g., "e2"
	To          string    `json:"to"`        // e.g., "e4"
	Piece       string    `json:"piece"`     // e.g., "wp" (white pawn)
	Captured    string    `json:"captured"`  // captured piece, if any
	Promotion   string    `json:"promotion"` // promotion piece for pawn promotion
	SAN         string    `json:"san"`       // Standard Algebraic Notation
	FEN         string    `json:"fen"`       // Board state after move
	Timestamp   time.Time `json:"timestamp"`
	IsCheck     bool      `json:"is_check"`
	IsCheckmate bool      `json:"is_checkmate"`
}

// GameStatus represents the current state of a game
type GameStatus string

const (
	GameStatusWaiting   GameStatus = "waiting"
	GameStatusActive    GameStatus = "active"
	GameStatusPaused    GameStatus = "paused"
	GameStatusFinished  GameStatus = "finished"
	GameStatusAbandoned GameStatus = "abandoned"
)

// GameResult represents the result of a finished game
type GameResult string

const (
	GameResultWhiteWins GameResult = "white_wins"
	GameResultBlackWins GameResult = "black_wins"
	GameResultDraw      GameResult = "draw"
	GameResultAbandoned GameResult = "abandoned"
)

// Game represents a chess game session
type Game struct {
	ID           string      `json:"id"`
	HostPeerID   string      `json:"host_peer_id"`
	Players      []*Player   `json:"players"`
	Status       GameStatus  `json:"status"`
	CurrentTurn  string      `json:"current_turn"` // "white" or "black"
	BoardFEN     string      `json:"board_fen"`    // Current board position in FEN notation
	Moves        []*Move     `json:"moves"`
	StartTime    time.Time   `json:"start_time"`
	EndTime      *time.Time  `json:"end_time,omitempty"`
	Result       *GameResult `json:"result,omitempty"`
	TimeControl  TimeControl `json:"time_control"`
	LastActivity time.Time   `json:"last_activity"`
	CreatedAt    time.Time   `json:"created_at"`
	UpdatedAt    time.Time   `json:"updated_at"`
}

// TimeControl represents time control settings for a game
type TimeControl struct {
	InitialTime int `json:"initial_time"` // seconds
	Increment   int `json:"increment"`    // seconds per move
	WhiteTime   int `json:"white_time"`   // remaining time in seconds
	BlackTime   int `json:"black_time"`   // remaining time in seconds
}

// NewGame creates a new chess game
func NewGame(hostPeerID string, hostPlayerName string) *Game {
	gameID := uuid.New().String()

	hostPlayer := &Player{
		ID:       uuid.New().String(),
		Name:     hostPlayerName,
		Color:    "white", // Host plays white by default
		PeerID:   hostPeerID,
		IsOnline: true,
	}

	return &Game{
		ID:           gameID,
		HostPeerID:   hostPeerID,
		Players:      []*Player{hostPlayer},
		Status:       GameStatusWaiting,
		CurrentTurn:  "white",
		BoardFEN:     "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", // Starting position
		Moves:        []*Move{},
		TimeControl:  TimeControl{InitialTime: 600, Increment: 5, WhiteTime: 600, BlackTime: 600}, // 10+5
		LastActivity: time.Now(),
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	}
}

// AddPlayer adds a player to the game
func (g *Game) AddPlayer(peerID, playerName string) error {
	if len(g.Players) >= 2 {
		return fmt.Errorf("game is full")
	}

	if g.Status != GameStatusWaiting {
		return fmt.Errorf("game is not accepting new players")
	}

	// Assign black color to the second player
	player := &Player{
		ID:       uuid.New().String(),
		Name:     playerName,
		Color:    "black",
		PeerID:   peerID,
		IsOnline: true,
	}

	g.Players = append(g.Players, player)
	g.UpdatedAt = time.Now()

	// Start the game if we now have 2 players
	if len(g.Players) == 2 {
		g.Status = GameStatusActive
		g.StartTime = time.Now()
	}

	return nil
}

// GetPlayer returns a player by peer ID
func (g *Game) GetPlayer(peerID string) *Player {
	for _, player := range g.Players {
		if player.PeerID == peerID {
			return player
		}
	}
	return nil
}

// GetOpponent returns the opponent of the given player
func (g *Game) GetOpponent(peerID string) *Player {
	for _, player := range g.Players {
		if player.PeerID != peerID {
			return player
		}
	}
	return nil
}

// MakeMove adds a move to the game and updates the board state
func (g *Game) MakeMove(move *Move) error {
	if g.Status != GameStatusActive {
		return fmt.Errorf("game is not active")
	}

	player := g.GetPlayer(move.PlayerID)
	if player == nil {
		return fmt.Errorf("player not found")
	}

	if player.Color != g.CurrentTurn {
		return fmt.Errorf("not player's turn")
	}

	// Add move to game history
	move.ID = uuid.New().String()
	move.GameID = g.ID
	move.Timestamp = time.Now()
	g.Moves = append(g.Moves, move)

	// Update board state
	g.BoardFEN = move.FEN

	// Switch turns
	if g.CurrentTurn == "white" {
		g.CurrentTurn = "black"
	} else {
		g.CurrentTurn = "white"
	}

	// Update activity
	g.LastActivity = time.Now()
	g.UpdatedAt = time.Now()

	// Check for game end conditions
	if move.IsCheckmate {
		g.Status = GameStatusFinished
		g.EndTime = &move.Timestamp
		if player.Color == "white" {
			result := GameResultWhiteWins
			g.Result = &result
		} else {
			result := GameResultBlackWins
			g.Result = &result
		}
	}

	return nil
}

// IsPlayerTurn checks if it's the specified player's turn
func (g *Game) IsPlayerTurn(peerID string) bool {
	player := g.GetPlayer(peerID)
	if player == nil {
		return false
	}
	return player.Color == g.CurrentTurn
}

// SetPlayerOnlineStatus updates a player's online status
func (g *Game) SetPlayerOnlineStatus(peerID string, isOnline bool) {
	player := g.GetPlayer(peerID)
	if player != nil {
		player.IsOnline = isOnline
		g.UpdatedAt = time.Now()
		if isOnline {
			g.LastActivity = time.Now()
		}
	}
}

// ToJSON converts the game to JSON
func (g *Game) ToJSON() ([]byte, error) {
	return json.Marshal(g)
}

// FromJSON creates a game from JSON
func FromJSON(data []byte) (*Game, error) {
	var game Game
	err := json.Unmarshal(data, &game)
	return &game, err
}

// GetGameState returns the current game state for frontend
func (g *Game) GetGameState() map[string]interface{} {
	state := map[string]interface{}{
		"id":            g.ID,
		"status":        g.Status,
		"current_turn":  g.CurrentTurn,
		"board_fen":     g.BoardFEN,
		"players":       g.Players,
		"last_move":     nil,
		"time_control":  g.TimeControl,
		"result":        g.Result,
		"move_count":    len(g.Moves),
		"last_activity": g.LastActivity,
	}

	if len(g.Moves) > 0 {
		state["last_move"] = g.Moves[len(g.Moves)-1]
	}

	return state
}

// GetMoveHistory returns the move history
func (g *Game) GetMoveHistory() []*Move {
	return g.Moves
}

// ValidateFEN performs basic FEN validation
func ValidateFEN(fen string) bool {
	parts := strings.Split(fen, " ")
	if len(parts) != 6 {
		return false
	}

	// Validate piece placement
	ranks := strings.Split(parts[0], "/")
	if len(ranks) != 8 {
		return false
	}

	for _, rank := range ranks {
		count := 0
		for _, char := range rank {
			if char >= '1' && char <= '8' {
				count += int(char - '0')
			} else if strings.ContainsRune("rnbqkpRNBQKP", char) {
				count++
			} else {
				return false
			}
		}
		if count != 8 {
			return false
		}
	}

	// Validate active color
	if parts[1] != "w" && parts[1] != "b" {
		return false
	}

	return true
}
