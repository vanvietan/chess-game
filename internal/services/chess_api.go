package services

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/vanvietannguyen/chess-game/internal/models"
)

type ChessAPIService struct {
	baseURL    string
	httpClient *http.Client
}

type ChessAPIRequest struct {
	FEN             string `json:"fen"`
	Variants        int    `json:"variants,omitempty"`
	Depth           int    `json:"depth,omitempty"`
	MaxThinkingTime int    `json:"maxThinkingTime,omitempty"`
	SearchMoves     string `json:"searchmoves,omitempty"`
}

type ChessAPIResponse struct {
	Text            string      `json:"text"`
	Eval            float64     `json:"eval"`
	Move            string      `json:"move"`
	FEN             string      `json:"fen"`
	Depth           int         `json:"depth"`
	WinChance       float64     `json:"winChance"`
	ContinuationArr []string    `json:"continuationArr"`
	Mate            *int        `json:"mate"`
	Centipawns      interface{} `json:"centipawns"` // Can be string or number
	SAN             string      `json:"san"`
	LAN             string      `json:"lan"`
	Turn            string      `json:"turn"`
	Color           string      `json:"color"`
	Piece           string      `json:"piece"`
	Flags           string      `json:"flags"`
	IsCapture       bool        `json:"isCapture"`
	IsCastling      bool        `json:"isCastling"`
	IsPromotion     bool        `json:"isPromotion"`
	From            string      `json:"from"`
	To              string      `json:"to"`
	FromNumeric     string      `json:"fromNumeric"`
	ToNumeric       string      `json:"toNumeric"`
	TaskID          string      `json:"taskId"`
	Time            int         `json:"time"`
	Type            string      `json:"type"`
}

func NewChessAPIService(baseURL string) *ChessAPIService {
	return &ChessAPIService{
		baseURL: baseURL,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// cleanFENForChessAPI cleans up FEN notation for Chess-API.com compatibility
func (c *ChessAPIService) cleanFENForChessAPI(fen string) string {
	parts := strings.Fields(fen)
	if len(parts) >= 6 {
		// If en passant square is present but may be invalid, clean it up
		// Chess-API.com is stricter about en passant notation
		enPassant := parts[3]
		if enPassant != "-" {
			// For now, let's be conservative and remove en passant if it's causing issues
			// In a full implementation, you'd validate if the en passant move is actually legal
			parts[3] = "-"
		}
		return strings.Join(parts, " ")
	}
	return fen
}

func (c *ChessAPIService) GetBestMove(ctx context.Context, fen string, settings *models.AISettings) (*models.AIMoveResponse, error) {
	// Clean FEN for Chess-API.com compatibility
	cleanedFEN := c.cleanFENForChessAPI(fen)

	request := ChessAPIRequest{
		FEN:             cleanedFEN,
		Variants:        1,
		Depth:           12,
		MaxThinkingTime: 50,
	}

	// Apply settings if provided
	if settings != nil {
		if settings.MaxDepth > 0 && settings.MaxDepth <= 18 {
			request.Depth = settings.MaxDepth
		}
		if settings.TimeLimit > 0 && settings.TimeLimit <= 100 {
			request.MaxThinkingTime = settings.TimeLimit
		}
	}

	// Convert request to JSON
	requestBody, err := json.Marshal(request)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	// Create HTTP request
	req, err := http.NewRequestWithContext(ctx, "POST", c.baseURL, bytes.NewBuffer(requestBody))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")

	// Send request
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("chess API returned status %d", resp.StatusCode)
	}

	// Parse response - use map to avoid struct field mismatches
	var rawResponse map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&rawResponse); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	// Extract fields we need
	move, _ := rawResponse["move"].(string)
	from, _ := rawResponse["from"].(string)
	to, _ := rawResponse["to"].(string)
	eval, _ := rawResponse["eval"].(float64)
	depth, _ := rawResponse["depth"].(float64) // Might be float
	isPromotion, _ := rawResponse["isPromotion"].(bool)

	// Convert to our format
	response := &models.AIMoveResponse{
		Success:    true,
		Move:       move,
		From:       from,
		To:         to,
		Evaluation: eval,
		Depth:      int(depth),
	}

	// Check for promotion
	if isPromotion && len(move) >= 4 {
		// Extract promotion piece from the move
		if len(move) > 4 {
			response.Promotion = string(move[len(move)-1])
		}
	}

	return response, nil
}

func (c *ChessAPIService) AnalyzePosition(ctx context.Context, fen string, depth int) (*PositionAnalysis, error) {
	// Clean FEN for Chess-API.com compatibility
	cleanedFEN := c.cleanFENForChessAPI(fen)

	request := ChessAPIRequest{
		FEN:             cleanedFEN,
		Variants:        3, // Get multiple variations for analysis
		Depth:           depth,
		MaxThinkingTime: 100,
	}

	if depth > 18 {
		request.Depth = 18 // Chess API max depth
	}

	requestBody, err := json.Marshal(request)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", c.baseURL, bytes.NewBuffer(requestBody))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("chess API returned status %d", resp.StatusCode)
	}

	var apiResponse ChessAPIResponse
	if err := json.NewDecoder(resp.Body).Decode(&apiResponse); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	analysis := &PositionAnalysis{
		Evaluation:         apiResponse.Eval,
		BestMove:           apiResponse.Move,
		PrincipalVariation: apiResponse.ContinuationArr,
		Depth:              apiResponse.Depth,
		Time:               apiResponse.Time,
	}

	// Set mate information if available
	if apiResponse.Mate != nil {
		analysis.Mate = apiResponse.Mate
	}

	return analysis, nil
}

func (c *ChessAPIService) Close() error {
	// No cleanup needed for HTTP client
	return nil
}
