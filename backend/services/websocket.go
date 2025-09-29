package services

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"github.com/libp2p/go-libp2p/core/peer"

	"chess-game/backend/models"
)

// WebSocketServer handles WebSocket connections from the frontend
type WebSocketServer struct {
	gameService *GameService
	p2pService  *P2PService
	upgrader    websocket.Upgrader
	clients     map[string]*WebSocketClient
}

// WebSocketClient represents a WebSocket client connection
type WebSocketClient struct {
	ID         string
	Conn       *websocket.Conn
	Send       chan []byte
	GameID     string
	PeerID     string
	PlayerName string
	server     *WebSocketServer
}

// WSRequestMessage represents incoming WebSocket messages from frontend
type WSRequestMessage struct {
	Type string                 `json:"type"`
	Data map[string]interface{} `json:"data,omitempty"`
}

// NewWebSocketServer creates a new WebSocket server
func NewWebSocketServer(gameService *GameService, p2pService *P2PService) *WebSocketServer {
	upgrader := websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool {
			// Allow connections from any origin in development
			// In production, you should validate the origin
			return true
		},
		ReadBufferSize:  1024,
		WriteBufferSize: 1024,
	}

	return &WebSocketServer{
		gameService: gameService,
		p2pService:  p2pService,
		upgrader:    upgrader,
		clients:     make(map[string]*WebSocketClient),
	}
}

// HandleWebSocket handles WebSocket connections
func (ws *WebSocketServer) HandleWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := ws.upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WebSocket upgrade error: %v", err)
		return
	}

	clientID := uuid.New().String()
	client := &WebSocketClient{
		ID:     clientID,
		Conn:   conn,
		Send:   make(chan []byte, 256),
		server: ws,
	}

	ws.clients[clientID] = client

	// Register client with game service
	wsClient := &WSClient{
		ID:       clientID,
		SendChan: client.Send,
	}
	ws.gameService.AddWSClient(clientID, wsClient)

	log.Printf("🔌 New WebSocket connection: %s", clientID)

	// Send initial connection message
	ws.sendToClient(client, "connected", map[string]interface{}{
		"client_id": clientID,
		"peer_id":   ws.p2pService.GetHostID().String(),
		"timestamp": time.Now(),
	})

	// Start goroutines for reading and writing
	go client.writePump()
	go client.readPump()
}

// sendToClient sends a message to a specific client
func (ws *WebSocketServer) sendToClient(client *WebSocketClient, msgType string, data map[string]interface{}) {
	message := models.NewWSMessage(models.MessageType(msgType))
	for key, value := range data {
		message.SetWSData(key, value)
	}

	msgBytes, err := message.ToWSJSON()
	if err != nil {
		log.Printf("Failed to marshal WebSocket message: %v", err)
		return
	}

	select {
	case client.Send <- msgBytes:
	default:
		close(client.Send)
		delete(ws.clients, client.ID)
	}
}

// readPump handles reading messages from the WebSocket connection
func (c *WebSocketClient) readPump() {
	defer func() {
		c.server.gameService.RemoveWSClient(c.ID)
		delete(c.server.clients, c.ID)
		c.Conn.Close()
	}()

	// Set read deadline and pong handler
	c.Conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	c.Conn.SetPongHandler(func(string) error {
		c.Conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})

	for {
		_, message, err := c.Conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("WebSocket error: %v", err)
			}
			break
		}

		// Parse message
		var wsMsg WSRequestMessage
		if err := json.Unmarshal(message, &wsMsg); err != nil {
			log.Printf("Failed to parse WebSocket message: %v", err)
			continue
		}

		// Handle message
		if err := c.handleMessage(&wsMsg); err != nil {
			log.Printf("Failed to handle WebSocket message: %v", err)
			c.server.sendToClient(c, "error", map[string]interface{}{
				"message": err.Error(),
			})
		}
	}
}

// writePump handles writing messages to the WebSocket connection
func (c *WebSocketClient) writePump() {
	ticker := time.NewTicker(54 * time.Second)
	defer func() {
		ticker.Stop()
		c.Conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.Send:
			c.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if !ok {
				c.Conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			w, err := c.Conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}
			w.Write(message)

			// Add queued messages to the current message
			n := len(c.Send)
			for i := 0; i < n; i++ {
				w.Write([]byte{'\n'})
				w.Write(<-c.Send)
			}

			if err := w.Close(); err != nil {
				return
			}

		case <-ticker.C:
			c.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.Conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

// handleMessage handles incoming WebSocket messages from frontend
func (c *WebSocketClient) handleMessage(msg *WSRequestMessage) error {
	log.Printf("📨 Received WebSocket message: %s from client %s", msg.Type, c.ID)

	switch msg.Type {
	case "create_game":
		return c.handleCreateGame(msg.Data)
	case "join_game":
		return c.handleJoinGame(msg.Data)
	case "make_move":
		return c.handleMakeMove(msg.Data)
	case "resign":
		return c.handleResign(msg.Data)
	case "offer_draw":
		return c.handleOfferDraw(msg.Data)
	case "respond_draw":
		return c.handleRespondDraw(msg.Data)
	case "connect_peer":
		return c.handleConnectPeer(msg.Data)
	case "disconnect":
		return c.handleDisconnect(msg.Data)
	case "get_game_state":
		return c.handleGetGameState(msg.Data)
	case "get_games":
		return c.handleGetGames(msg.Data)
	case "ping":
		return c.handlePing(msg.Data)
	default:
		log.Printf("Unknown message type: %s", msg.Type)
		return nil
	}
}

// handleCreateGame handles game creation requests
func (c *WebSocketClient) handleCreateGame(data map[string]interface{}) error {
	playerName, _ := data["player_name"].(string)
	if playerName == "" {
		playerName = "Player"
	}

	// Create new game
	game, err := c.server.gameService.CreateGame(c.server.p2pService.GetHostID().String(), playerName)
	if err != nil {
		return err
	}

	c.GameID = game.ID
	c.PlayerName = playerName
	c.PeerID = c.server.p2pService.GetHostID().String()

	// Send response
	c.server.sendToClient(c, "game_created", map[string]interface{}{
		"game": game,
	})

	return nil
}

// handleJoinGame handles game join requests
func (c *WebSocketClient) handleJoinGame(data map[string]interface{}) error {
	gameID, _ := data["game_id"].(string)
	playerName, _ := data["player_name"].(string)
	hostPeerID, _ := data["host_peer_id"].(string)

	if gameID == "" || hostPeerID == "" {
		return fmt.Errorf("missing required parameters")
	}

	if playerName == "" {
		playerName = "Player"
	}

	c.GameID = gameID
	c.PlayerName = playerName
	c.PeerID = c.server.p2pService.GetHostID().String()

	// Send join request to host peer
	peerID, err := peer.Decode(hostPeerID)
	if err != nil {
		return fmt.Errorf("invalid peer ID: %w", err)
	}

	joinMsg := models.NewMessage(models.MessageTypeGameJoin, c.PeerID, gameID)
	joinMsg.SetData("player_name", playerName)

	return c.server.p2pService.SendMessage(peerID, joinMsg)
}

// handleMakeMove handles move requests
func (c *WebSocketClient) handleMakeMove(data map[string]interface{}) error {
	if c.GameID == "" {
		return fmt.Errorf("not in a game")
	}

	// Extract move data
	from, _ := data["from"].(string)
	to, _ := data["to"].(string)
	piece, _ := data["piece"].(string)
	captured, _ := data["captured"].(string)
	promotion, _ := data["promotion"].(string)
	san, _ := data["san"].(string)
	fen, _ := data["fen"].(string)
	isCheck, _ := data["is_check"].(bool)
	isCheckmate, _ := data["is_checkmate"].(bool)

	move := &models.Move{
		GameID:      c.GameID,
		PlayerID:    c.PeerID,
		From:        from,
		To:          to,
		Piece:       piece,
		Captured:    captured,
		Promotion:   promotion,
		SAN:         san,
		FEN:         fen,
		IsCheck:     isCheck,
		IsCheckmate: isCheckmate,
	}

	// Process move locally
	game, err := c.server.gameService.ProcessMove(c.GameID, move)
	if err != nil {
		return err
	}

	// Send move to opponent
	opponent := game.GetOpponent(c.PeerID)
	if opponent != nil {
		opponentPeerID, err := peer.Decode(opponent.PeerID)
		if err == nil {
			moveMsg := models.CreateMoveMessage(c.PeerID, c.GameID, move)
			c.server.p2pService.SendMessage(opponentPeerID, moveMsg)
		}
	}

	// Send response to frontend
	c.server.sendToClient(c, "move_made", map[string]interface{}{
		"move": move,
		"game": game,
	})

	return nil
}

// handleResign handles resignation requests
func (c *WebSocketClient) handleResign(data map[string]interface{}) error {
	if c.GameID == "" {
		return fmt.Errorf("not in a game")
	}

	// Process resignation
	game, err := c.server.gameService.ResignGame(c.GameID, c.PeerID)
	if err != nil {
		return err
	}

	// Send resignation to opponent
	opponent := game.GetOpponent(c.PeerID)
	if opponent != nil {
		opponentPeerID, err := peer.Decode(opponent.PeerID)
		if err == nil {
			resignMsg := models.NewMessage(models.MessageTypeResign, c.PeerID, c.GameID)
			c.server.p2pService.SendMessage(opponentPeerID, resignMsg)
		}
	}

	// Send response to frontend
	c.server.sendToClient(c, "resignation_processed", map[string]interface{}{
		"game": game,
	})

	return nil
}

// handleOfferDraw handles draw offer requests
func (c *WebSocketClient) handleOfferDraw(data map[string]interface{}) error {
	if c.GameID == "" {
		return fmt.Errorf("not in a game")
	}

	reason, _ := data["reason"].(string)

	game := c.server.gameService.GetGame(c.GameID)
	if game == nil {
		return fmt.Errorf("game not found")
	}

	// Send draw offer to opponent
	opponent := game.GetOpponent(c.PeerID)
	if opponent != nil {
		opponentPeerID, err := peer.Decode(opponent.PeerID)
		if err == nil {
			drawMsg := models.CreateDrawOfferMessage(c.PeerID, c.GameID, c.PeerID, reason)
			c.server.p2pService.SendMessage(opponentPeerID, drawMsg)
		}
	}

	// Send confirmation to frontend
	c.server.sendToClient(c, "draw_offer_sent", map[string]interface{}{
		"game_id": c.GameID,
		"reason":  reason,
	})

	return nil
}

// handleRespondDraw handles draw response
func (c *WebSocketClient) handleRespondDraw(data map[string]interface{}) error {
	if c.GameID == "" {
		return fmt.Errorf("not in a game")
	}

	accepted, _ := data["accepted"].(bool)
	reason, _ := data["reason"].(string)

	game := c.server.gameService.GetGame(c.GameID)
	if game == nil {
		return fmt.Errorf("game not found")
	}

	if accepted {
		// Process draw
		game, err := c.server.gameService.DrawGame(c.GameID)
		if err != nil {
			return err
		}

		// Send response to frontend
		c.server.sendToClient(c, "game_drawn", map[string]interface{}{
			"game": game,
		})
	}

	// Send response to opponent
	opponent := game.GetOpponent(c.PeerID)
	if opponent != nil {
		opponentPeerID, err := peer.Decode(opponent.PeerID)
		if err == nil {
			responseMsg := models.NewMessage(models.MessageTypeDrawResponse, c.PeerID, c.GameID)
			responseMsg.SetData("accepted", accepted)
			responseMsg.SetData("reason", reason)
			c.server.p2pService.SendMessage(opponentPeerID, responseMsg)
		}
	}

	return nil
}

// handleConnectPeer handles peer connection requests
func (c *WebSocketClient) handleConnectPeer(data map[string]interface{}) error {
	peerAddr, _ := data["peer_address"].(string)
	if peerAddr == "" {
		return fmt.Errorf("missing peer address")
	}

	return c.server.p2pService.ConnectToPeer(peerAddr)
}

// handleDisconnect handles disconnection requests
func (c *WebSocketClient) handleDisconnect(data map[string]interface{}) error {
	// Clean up client
	c.server.gameService.RemoveWSClient(c.ID)
	delete(c.server.clients, c.ID)
	return nil
}

// handleGetGameState handles game state requests
func (c *WebSocketClient) handleGetGameState(data map[string]interface{}) error {
	gameID, _ := data["game_id"].(string)
	if gameID == "" {
		gameID = c.GameID
	}

	if gameID == "" {
		return fmt.Errorf("no game ID provided")
	}

	game := c.server.gameService.GetGame(gameID)
	if game == nil {
		return fmt.Errorf("game not found")
	}

	c.server.sendToClient(c, "game_state", map[string]interface{}{
		"game": game,
	})

	return nil
}

// handleGetGames handles get games requests
func (c *WebSocketClient) handleGetGames(data map[string]interface{}) error {
	games := c.server.gameService.GetActiveGames()
	stats := c.server.gameService.GetGameStats()

	c.server.sendToClient(c, "games_list", map[string]interface{}{
		"games": games,
		"stats": stats,
	})

	return nil
}

// handlePing handles ping requests
func (c *WebSocketClient) handlePing(data map[string]interface{}) error {
	c.server.sendToClient(c, "pong", map[string]interface{}{
		"timestamp": time.Now(),
	})
	return nil
}
