package api

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/vanvietannguyen/chess-game/internal/models"
	"github.com/vanvietannguyen/chess-game/internal/services"
)

func SetupRoutes(r *gin.Engine, gameService *services.GameService, chessEngine services.ChessEngine) {
	api := r.Group("/api")
	{
		// Game management
		api.POST("/games", createGame(gameService))
		api.GET("/games/:gameId", getGame(gameService))
		api.DELETE("/games/:gameId", deleteGame(gameService))
		api.GET("/games", listGames(gameService))

		// Game moves
		api.POST("/games/:gameId/moves", makeMove(gameService))
		api.POST("/games/:gameId/ai-move", getAIMove(gameService))

		// Analysis
		api.POST("/games/:gameId/analyze", analyzePosition(gameService))

		// Health check
		api.GET("/health", healthCheck)
	}

	// WebSocket endpoint for real-time game updates
	api.GET("/ws", handleWebSocket)
}

func createGame(gameService *services.GameService) gin.HandlerFunc {
	return func(c *gin.Context) {
		var req models.GameCreateRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		response, err := gameService.CreateGame(&req)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusCreated, response)
	}
}

func getGame(gameService *services.GameService) gin.HandlerFunc {
	return func(c *gin.Context) {
		gameID := c.Param("gameId")

		game, err := gameService.GetGame(gameID)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"game": game})
	}
}

func deleteGame(gameService *services.GameService) gin.HandlerFunc {
	return func(c *gin.Context) {
		gameID := c.Param("gameId")

		err := gameService.DeleteGame(gameID)
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "Game deleted successfully"})
	}
}

func listGames(gameService *services.GameService) gin.HandlerFunc {
	return func(c *gin.Context) {
		games := gameService.ListGames()
		c.JSON(http.StatusOK, gin.H{"games": games})
	}
}

func makeMove(gameService *services.GameService) gin.HandlerFunc {
	return func(c *gin.Context) {
		gameID := c.Param("gameId")
		if gameID == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Game ID is required"})
			return
		}

		var req models.MoveRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		req.GameID = gameID
		response, err := gameService.MakeMove(&req)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		if !response.Success {
			c.JSON(http.StatusBadRequest, response)
			return
		}

		c.JSON(http.StatusOK, response)
	}
}

func getAIMove(gameService *services.GameService) gin.HandlerFunc {
	return func(c *gin.Context) {
		gameID := c.Param("gameId")

		var req models.AIMoveRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		req.GameID = gameID
		response, err := gameService.GetAIMove(c.Request.Context(), &req)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		if !response.Success {
			c.JSON(http.StatusBadRequest, response)
			return
		}

		c.JSON(http.StatusOK, response)
	}
}

func analyzePosition(gameService *services.GameService) gin.HandlerFunc {
	return func(c *gin.Context) {
		gameID := c.Param("gameId")

		fen := c.Query("fen")
		if fen == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "FEN parameter is required"})
			return
		}

		depthStr := c.DefaultQuery("depth", "12")
		depth, err := strconv.Atoi(depthStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid depth parameter"})
			return
		}

		analysis, err := gameService.AnalyzePosition(c.Request.Context(), gameID, fen, depth)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"analysis": analysis})
	}
}

func healthCheck(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":    "healthy",
		"timestamp": "2023-01-01T00:00:00Z",
		"service":   "chess-game-api",
	})
}
