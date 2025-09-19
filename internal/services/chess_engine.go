package services

import (
	"context"

	"github.com/vanvietannguyen/chess-game/internal/models"
)

// ChessEngine interface defines the contract for chess engines
type ChessEngine interface {
	// GetBestMove returns the best move for the given position
	GetBestMove(ctx context.Context, fen string, settings *models.AISettings) (*models.AIMoveResponse, error)

	// AnalyzePosition returns position analysis
	AnalyzePosition(ctx context.Context, fen string, depth int) (*PositionAnalysis, error)

	// Close cleans up resources
	Close() error
}

type PositionAnalysis struct {
	Evaluation         float64  `json:"evaluation"`
	BestMove           string   `json:"bestMove"`
	PrincipalVariation []string `json:"principalVariation"`
	Depth              int      `json:"depth"`
	NodesSearched      int64    `json:"nodesSearched"`
	Time               int      `json:"time"`
	Mate               *int     `json:"mate,omitempty"`
}
