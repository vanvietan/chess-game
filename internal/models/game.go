package models

import (
	"time"

	"github.com/notnil/chess"
)

type GameMode string

const (
	GameModePvP GameMode = "pvp"
	GameModeAI  GameMode = "ai"
)

type GameStatus string

const (
	GameStatusPlaying   GameStatus = "playing"
	GameStatusCheckmate GameStatus = "checkmate"
	GameStatusStalemate GameStatus = "stalemate"
	GameStatusDraw      GameStatus = "draw"
	GameStatusResigned  GameStatus = "resigned"
)

type Player struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Color string `json:"color"` // "white" or "black"
}

type Game struct {
	ID          string      `json:"id"`
	Players     []Player    `json:"players"`
	Game        *chess.Game `json:"-"`
	Status      GameStatus  `json:"status"`
	Mode        GameMode    `json:"mode"`
	CurrentTurn string      `json:"currentTurn"`
	FEN         string      `json:"fen"`
	PGN         string      `json:"pgn"`
	MoveHistory []string    `json:"moveHistory"`
	AISettings  *AISettings `json:"aiSettings,omitempty"`
	CreatedAt   time.Time   `json:"createdAt"`
	UpdatedAt   time.Time   `json:"updatedAt"`
}

type AISettings struct {
	Color      string `json:"color"`      // "white", "black", or "random"
	Difficulty int    `json:"difficulty"` // 1-20 for Stockfish, 1-18 for Chess-API
	MaxDepth   int    `json:"maxDepth"`   // Search depth
	TimeLimit  int    `json:"timeLimit"`  // Time limit in milliseconds
}

type MoveRequest struct {
	GameID    string `json:"gameId,omitempty"` // Optional in JSON since it comes from URL path
	From      string `json:"from" binding:"required"`
	To        string `json:"to" binding:"required"`
	Promotion string `json:"promotion,omitempty"`
}

type MoveResponse struct {
	Success     bool   `json:"success"`
	Move        string `json:"move,omitempty"`
	FEN         string `json:"fen,omitempty"`
	PGN         string `json:"pgn,omitempty"`
	GameStatus  string `json:"gameStatus,omitempty"`
	CurrentTurn string `json:"currentTurn,omitempty"`
	Error       string `json:"error,omitempty"`
	IsCheck     bool   `json:"isCheck"`
	IsCheckmate bool   `json:"isCheckmate"`
	IsStalemate bool   `json:"isStalemate"`
}

type AIMoveRequest struct {
	GameID string `json:"gameId,omitempty"` // Optional in JSON since it comes from URL path
	FEN    string `json:"fen" binding:"required"`
}

type AIMoveResponse struct {
	Success    bool    `json:"success"`
	Move       string  `json:"move,omitempty"`
	From       string  `json:"from,omitempty"`
	To         string  `json:"to,omitempty"`
	Promotion  string  `json:"promotion,omitempty"`
	Evaluation float64 `json:"evaluation,omitempty"`
	Depth      int     `json:"depth,omitempty"`
	Error      string  `json:"error,omitempty"`
}

type GameCreateRequest struct {
	Mode       GameMode    `json:"mode" binding:"required"`
	PlayerName string      `json:"playerName"`
	AISettings *AISettings `json:"aiSettings,omitempty"`
}

type GameCreateResponse struct {
	Success bool   `json:"success"`
	GameID  string `json:"gameId,omitempty"`
	Game    *Game  `json:"game,omitempty"`
	Error   string `json:"error,omitempty"`
}
