package api

import (
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		// Allow connections from any origin in development
		// In production, you should implement proper origin checking
		return true
	},
}

type WSMessage struct {
	Type   string      `json:"type"`
	GameID string      `json:"gameId,omitempty"`
	Data   interface{} `json:"data,omitempty"`
	Error  string      `json:"error,omitempty"`
}

type GameUpdate struct {
	GameID      string `json:"gameId"`
	Move        string `json:"move"`
	FEN         string `json:"fen"`
	CurrentTurn string `json:"currentTurn"`
	GameStatus  string `json:"gameStatus"`
	IsCheck     bool   `json:"isCheck"`
	IsCheckmate bool   `json:"isCheckmate"`
	IsStalemate bool   `json:"isStalemate"`
}

// Global connections map to track WebSocket connections per game
var gameConnections = make(map[string][]*websocket.Conn)

func handleWebSocket(c *gin.Context) {
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("WebSocket upgrade error: %v", err)
		return
	}
	defer conn.Close()

	// Handle WebSocket messages
	for {
		var msg WSMessage
		err := conn.ReadJSON(&msg)
		if err != nil {
			log.Printf("WebSocket read error: %v", err)
			break
		}

		switch msg.Type {
		case "join_game":
			if msg.GameID != "" {
				joinGame(conn, msg.GameID)
			}
		case "leave_game":
			if msg.GameID != "" {
				leaveGame(conn, msg.GameID)
			}
		case "ping":
			// Respond to ping with pong
			response := WSMessage{
				Type: "pong",
			}
			if err := conn.WriteJSON(response); err != nil {
				log.Printf("WebSocket write error: %v", err)
				break
			}
		}
	}

	// Clean up connections when client disconnects
	cleanupConnection(conn)
}

func joinGame(conn *websocket.Conn, gameID string) {
	if gameConnections[gameID] == nil {
		gameConnections[gameID] = make([]*websocket.Conn, 0)
	}
	gameConnections[gameID] = append(gameConnections[gameID], conn)

	log.Printf("Client joined game: %s", gameID)

	// Send confirmation
	response := WSMessage{
		Type:   "joined_game",
		GameID: gameID,
	}
	conn.WriteJSON(response)
}

func leaveGame(conn *websocket.Conn, gameID string) {
	if connections, exists := gameConnections[gameID]; exists {
		for i, c := range connections {
			if c == conn {
				// Remove connection from slice
				gameConnections[gameID] = append(connections[:i], connections[i+1:]...)
				break
			}
		}

		// Clean up empty game connection lists
		if len(gameConnections[gameID]) == 0 {
			delete(gameConnections, gameID)
		}
	}

	log.Printf("Client left game: %s", gameID)
}

func cleanupConnection(conn *websocket.Conn) {
	// Remove connection from all games
	for gameID, connections := range gameConnections {
		for i, c := range connections {
			if c == conn {
				gameConnections[gameID] = append(connections[:i], connections[i+1:]...)
				break
			}
		}

		// Clean up empty game connection lists
		if len(gameConnections[gameID]) == 0 {
			delete(gameConnections, gameID)
		}
	}
}

// BroadcastGameUpdate sends a game update to all connected clients for a specific game
func BroadcastGameUpdate(gameID string, update GameUpdate) {
	connections, exists := gameConnections[gameID]
	if !exists || len(connections) == 0 {
		return
	}

	message := WSMessage{
		Type:   "game_update",
		GameID: gameID,
		Data:   update,
	}

	// Send to all connections, removing any that fail
	validConnections := make([]*websocket.Conn, 0)
	for _, conn := range connections {
		if err := conn.WriteJSON(message); err != nil {
			log.Printf("Failed to send WebSocket message: %v", err)
			// Don't add to valid connections
		} else {
			validConnections = append(validConnections, conn)
		}
	}

	// Update the connections list with only valid ones
	if len(validConnections) == 0 {
		delete(gameConnections, gameID)
	} else {
		gameConnections[gameID] = validConnections
	}
}
