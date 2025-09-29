package models

import (
	"encoding/json"
	"time"
)

// MessageType represents different types of messages in the P2P network
type MessageType string

const (
	// Game discovery and joining
	MessageTypeGameInvite  MessageType = "game_invite"
	MessageTypeGameJoin    MessageType = "game_join"
	MessageTypeGameAccept  MessageType = "game_accept"
	MessageTypeGameDecline MessageType = "game_decline"
	MessageTypeGameStart   MessageType = "game_start"

	// Game actions
	MessageTypeMove         MessageType = "move"
	MessageTypeMoveResponse MessageType = "move_response"
	MessageTypeGameState    MessageType = "game_state"
	MessageTypeGameSync     MessageType = "game_sync"

	// Game management
	MessageTypeGamePause    MessageType = "game_pause"
	MessageTypeGameResume   MessageType = "game_resume"
	MessageTypeGameEnd      MessageType = "game_end"
	MessageTypeGameAbandon  MessageType = "game_abandon"
	MessageTypeResign       MessageType = "resign"
	MessageTypeDrawOffer    MessageType = "draw_offer"
	MessageTypeDrawResponse MessageType = "draw_response"

	// Connection management
	MessageTypePing       MessageType = "ping"
	MessageTypePong       MessageType = "pong"
	MessageTypeDisconnect MessageType = "disconnect"
	MessageTypeReconnect  MessageType = "reconnect"

	// Player management
	MessageTypePlayerUpdate MessageType = "player_update"
	MessageTypePlayerList   MessageType = "player_list"

	// Error handling
	MessageTypeError MessageType = "error"
)

// Message represents a P2P message
type Message struct {
	Type      MessageType            `json:"type"`
	ID        string                 `json:"id"`
	GameID    string                 `json:"game_id,omitempty"`
	SenderID  string                 `json:"sender_id"`
	Data      map[string]interface{} `json:"data,omitempty"`
	Timestamp time.Time              `json:"timestamp"`
}

// GameInviteData represents data for game invitation
type GameInviteData struct {
	GameID      string      `json:"game_id"`
	HostName    string      `json:"host_name"`
	TimeControl TimeControl `json:"time_control"`
	Message     string      `json:"message,omitempty"`
}

// MoveData represents move data
type MoveData struct {
	Move   *Move  `json:"move"`
	GameID string `json:"game_id"`
}

// GameStateData represents full game state
type GameStateData struct {
	Game *Game `json:"game"`
}

// ErrorData represents error information
type ErrorData struct {
	Code    string `json:"code"`
	Message string `json:"message"`
	Details string `json:"details,omitempty"`
}

// PlayerUpdateData represents player status update
type PlayerUpdateData struct {
	PlayerID string `json:"player_id"`
	IsOnline bool   `json:"is_online"`
	Name     string `json:"name,omitempty"`
}

// DrawOfferData represents draw offer information
type DrawOfferData struct {
	GameID   string `json:"game_id"`
	PlayerID string `json:"player_id"`
	Reason   string `json:"reason,omitempty"`
}

// NewMessage creates a new message
func NewMessage(msgType MessageType, senderID string, gameID string) *Message {
	return &Message{
		Type:      msgType,
		ID:        generateMessageID(),
		GameID:    gameID,
		SenderID:  senderID,
		Data:      make(map[string]interface{}),
		Timestamp: time.Now(),
	}
}

// SetData sets the message data
func (m *Message) SetData(key string, value interface{}) {
	if m.Data == nil {
		m.Data = make(map[string]interface{})
	}
	m.Data[key] = value
}

// GetData gets data from the message
func (m *Message) GetData(key string) (interface{}, bool) {
	if m.Data == nil {
		return nil, false
	}
	value, exists := m.Data[key]
	return value, exists
}

// ToJSON converts message to JSON
func (m *Message) ToJSON() ([]byte, error) {
	return json.Marshal(m)
}

// FromJSON creates a message from JSON
func MessageFromJSON(data []byte) (*Message, error) {
	var msg Message
	err := json.Unmarshal(data, &msg)
	return &msg, err
}

// CreateGameInviteMessage creates a game invitation message
func CreateGameInviteMessage(senderID string, gameID string, hostName string, timeControl TimeControl, message string) *Message {
	msg := NewMessage(MessageTypeGameInvite, senderID, gameID)
	msg.SetData("host_name", hostName)
	msg.SetData("time_control", timeControl)
	if message != "" {
		msg.SetData("message", message)
	}
	return msg
}

// CreateMoveMessage creates a move message
func CreateMoveMessage(senderID string, gameID string, move *Move) *Message {
	msg := NewMessage(MessageTypeMove, senderID, gameID)
	msg.SetData("move", move)
	return msg
}

// CreateGameStateMessage creates a game state message
func CreateGameStateMessage(senderID string, game *Game) *Message {
	msg := NewMessage(MessageTypeGameState, senderID, game.ID)
	msg.SetData("game", game)
	return msg
}

// CreateErrorMessage creates an error message
func CreateErrorMessage(senderID string, gameID string, code string, message string, details string) *Message {
	msg := NewMessage(MessageTypeError, senderID, gameID)
	errorData := ErrorData{
		Code:    code,
		Message: message,
		Details: details,
	}
	msg.SetData("error", errorData)
	return msg
}

// CreatePlayerUpdateMessage creates a player update message
func CreatePlayerUpdateMessage(senderID string, gameID string, playerID string, isOnline bool, name string) *Message {
	msg := NewMessage(MessageTypePlayerUpdate, senderID, gameID)
	updateData := PlayerUpdateData{
		PlayerID: playerID,
		IsOnline: isOnline,
		Name:     name,
	}
	msg.SetData("player_update", updateData)
	return msg
}

// CreateDrawOfferMessage creates a draw offer message
func CreateDrawOfferMessage(senderID string, gameID string, playerID string, reason string) *Message {
	msg := NewMessage(MessageTypeDrawOffer, senderID, gameID)
	drawData := DrawOfferData{
		GameID:   gameID,
		PlayerID: playerID,
		Reason:   reason,
	}
	msg.SetData("draw_offer", drawData)
	return msg
}

// CreatePingMessage creates a ping message
func CreatePingMessage(senderID string) *Message {
	return NewMessage(MessageTypePing, senderID, "")
}

// CreatePongMessage creates a pong message
func CreatePongMessage(senderID string) *Message {
	return NewMessage(MessageTypePong, senderID, "")
}

// generateMessageID generates a unique message ID
func generateMessageID() string {
	return time.Now().Format("20060102150405") + "-" + generateRandomString(8)
}

// generateRandomString generates a random string of given length
func generateRandomString(length int) string {
	const charset = "abcdefghijklmnopqrstuvwxyz0123456789"
	result := make([]byte, length)
	for i := range result {
		result[i] = charset[time.Now().UnixNano()%int64(len(charset))]
	}
	return string(result)
}

// WSMessage represents a WebSocket message between frontend and backend
type WSMessage struct {
	Type MessageType            `json:"type"`
	Data map[string]interface{} `json:"data,omitempty"`
}

// NewWSMessage creates a new WebSocket message
func NewWSMessage(msgType MessageType) *WSMessage {
	return &WSMessage{
		Type: msgType,
		Data: make(map[string]interface{}),
	}
}

// SetWSData sets WebSocket message data
func (m *WSMessage) SetWSData(key string, value interface{}) {
	if m.Data == nil {
		m.Data = make(map[string]interface{})
	}
	m.Data[key] = value
}

// ToWSJSON converts WebSocket message to JSON
func (m *WSMessage) ToWSJSON() ([]byte, error) {
	return json.Marshal(m)
}
