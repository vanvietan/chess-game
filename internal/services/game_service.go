package services

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	mathrand "math/rand"
	"sync"
	"time"

	"github.com/notnil/chess"
	"github.com/vanvietannguyen/chess-game/internal/models"
)

type GameService struct {
	games       map[string]*models.Game
	chessEngine ChessEngine
	mutex       sync.RWMutex
}

func NewGameService(chessEngine ChessEngine) *GameService {
	return &GameService{
		games:       make(map[string]*models.Game),
		chessEngine: chessEngine,
	}
}

// generateID creates a simple random ID
func generateID() string {
	bytes := make([]byte, 16)
	if _, err := rand.Read(bytes); err != nil {
		// Fallback to time-based ID if crypto/rand fails
		return fmt.Sprintf("%d", time.Now().UnixNano())
	}
	return hex.EncodeToString(bytes)
}

func (gs *GameService) CreateGame(req *models.GameCreateRequest) (*models.GameCreateResponse, error) {
	gs.mutex.Lock()
	defer gs.mutex.Unlock()

	gameID := generateID()
	chessGame := chess.NewGame()

	game := &models.Game{
		ID:          gameID,
		Game:        chessGame,
		Status:      models.GameStatusPlaying,
		Mode:        req.Mode,
		CurrentTurn: "white",
		FEN:         chessGame.Position().String(),
		PGN:         chessGame.String(),
		MoveHistory: []string{},
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	// Set up players
	if req.Mode == models.GameModePvP {
		game.Players = []models.Player{
			{ID: generateID(), Name: req.PlayerName, Color: "white"},
			{ID: generateID(), Name: "Player 2", Color: "black"},
		}
	} else if req.Mode == models.GameModeAI {
		if req.AISettings == nil {
			req.AISettings = &models.AISettings{
				Color:      "black",
				Difficulty: 8,
				MaxDepth:   12,
				TimeLimit:  1000,
			}
		}

		// Handle random color selection
		if req.AISettings.Color == "random" {
			colors := []string{"white", "black"}
			req.AISettings.Color = colors[mathrand.Intn(len(colors))]
		}

		game.AISettings = req.AISettings

		if req.AISettings.Color == "white" {
			game.Players = []models.Player{
				{ID: "ai", Name: "AI", Color: "white"},
				{ID: generateID(), Name: req.PlayerName, Color: "black"},
			}
		} else {
			game.Players = []models.Player{
				{ID: generateID(), Name: req.PlayerName, Color: "white"},
				{ID: "ai", Name: "AI", Color: "black"},
			}
		}
	}

	gs.games[gameID] = game

	return &models.GameCreateResponse{
		Success: true,
		GameID:  gameID,
		Game:    game,
	}, nil
}

func (gs *GameService) GetGame(gameID string) (*models.Game, error) {
	gs.mutex.RLock()
	defer gs.mutex.RUnlock()

	game, exists := gs.games[gameID]
	if !exists {
		return nil, fmt.Errorf("game not found: %s", gameID)
	}

	return game, nil
}

func (gs *GameService) MakeMove(req *models.MoveRequest) (*models.MoveResponse, error) {
	gs.mutex.Lock()
	defer gs.mutex.Unlock()

	game, exists := gs.games[req.GameID]
	if !exists {
		return &models.MoveResponse{
			Success: false,
			Error:   "Game not found",
		}, nil
	}

	if game.Status != models.GameStatusPlaying {
		return &models.MoveResponse{
			Success: false,
			Error:   "Game is not in playing state",
		}, nil
	}

	// Create move notation - try UCI/Long Algebraic format first
	moveNotation := req.From + req.To
	if req.Promotion != "" {
		moveNotation += req.Promotion
	}

	// Get all valid moves and find the one matching our from/to coordinates
	validMoves := game.Game.ValidMoves()

	// Find the move by matching from/to squares exactly
	var targetMove *chess.Move
	for _, move := range validMoves {
		if move.S1().String() == req.From && move.S2().String() == req.To {
			targetMove = move
			break
		}
	}

	if targetMove != nil {
		// Use the exact Move object instead of string parsing
		err := game.Game.Move(targetMove)
		if err != nil {
			return &models.MoveResponse{
				Success: false,
				Error:   fmt.Sprintf("Invalid move execution: %v", err),
			}, nil
		}
	} else {
		// Fallback to string parsing
		err := game.Game.MoveStr(moveNotation)
		if err != nil {
			return &models.MoveResponse{
				Success: false,
				Error:   fmt.Sprintf("Invalid move: %v", err),
			}, nil
		}
	}

	// Update game state
	game.FEN = game.Game.Position().String()
	game.PGN = game.Game.String()
	game.MoveHistory = append(game.MoveHistory, moveNotation)
	game.UpdatedAt = time.Now()

	// Check game outcome
	outcome := game.Game.Outcome()
	method := game.Game.Method()

	switch outcome {
	case chess.WhiteWon:
		game.Status = models.GameStatusCheckmate
		game.CurrentTurn = ""
	case chess.BlackWon:
		game.Status = models.GameStatusCheckmate
		game.CurrentTurn = ""
	case chess.Draw:
		if method == chess.Stalemate {
			game.Status = models.GameStatusStalemate
		} else {
			game.Status = models.GameStatusDraw
		}
		game.CurrentTurn = ""
	default:
		// Game continues
		if game.Game.Position().Turn() == chess.White {
			game.CurrentTurn = "white"
		} else {
			game.CurrentTurn = "black"
		}
	}

	// Simple check detection - for now we'll set this to false
	// In a real implementation, you'd implement proper check detection by examining attacks on the king
	isCheck := false

	response := &models.MoveResponse{
		Success:     true,
		Move:        moveNotation,
		FEN:         game.FEN,
		PGN:         game.PGN,
		GameStatus:  string(game.Status),
		CurrentTurn: game.CurrentTurn,
		IsCheck:     isCheck,
		IsCheckmate: outcome != chess.NoOutcome && method == chess.Checkmate,
		IsStalemate: outcome == chess.Draw && method == chess.Stalemate,
	}

	return response, nil
}

func (gs *GameService) GetAIMove(ctx context.Context, req *models.AIMoveRequest) (*models.AIMoveResponse, error) {
	gs.mutex.RLock()
	game, exists := gs.games[req.GameID]
	if !exists {
		gs.mutex.RUnlock()
		return &models.AIMoveResponse{
			Success: false,
			Error:   "Game not found",
		}, nil
	}

	if game.Mode != models.GameModeAI {
		gs.mutex.RUnlock()
		return &models.AIMoveResponse{
			Success: false,
			Error:   "Game is not in AI mode",
		}, nil
	}

	if game.Status != models.GameStatusPlaying {
		gs.mutex.RUnlock()
		return &models.AIMoveResponse{
			Success: false,
			Error:   "Game is not in playing state",
		}, nil
	}

	aiSettings := game.AISettings
	gs.mutex.RUnlock()

	// Get AI move from chess engine
	aiResponse, err := gs.chessEngine.GetBestMove(ctx, req.FEN, aiSettings)
	if err != nil {
		return &models.AIMoveResponse{
			Success: false,
			Error:   fmt.Sprintf("Failed to get AI move: %v", err),
		}, nil
	}

	return aiResponse, nil
}

func (gs *GameService) AnalyzePosition(ctx context.Context, gameID, fen string, depth int) (*PositionAnalysis, error) {
	gs.mutex.RLock()
	_, exists := gs.games[gameID]
	gs.mutex.RUnlock()

	if !exists {
		return nil, fmt.Errorf("game not found: %s", gameID)
	}

	return gs.chessEngine.AnalyzePosition(ctx, fen, depth)
}

func (gs *GameService) DeleteGame(gameID string) error {
	gs.mutex.Lock()
	defer gs.mutex.Unlock()

	if _, exists := gs.games[gameID]; !exists {
		return fmt.Errorf("game not found: %s", gameID)
	}

	delete(gs.games, gameID)
	return nil
}

func (gs *GameService) ListGames() []*models.Game {
	gs.mutex.RLock()
	defer gs.mutex.RUnlock()

	games := make([]*models.Game, 0, len(gs.games))
	for _, game := range gs.games {
		games = append(games, game)
	}

	return games
}
