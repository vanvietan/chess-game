package services

import (
	"encoding/json"
	"fmt"
	"log"

	"github.com/libp2p/go-libp2p/core/peer"

	"chess-game/backend/models"
)

// handleGameInvite handles game invitation messages
func (p *P2PService) handleGameInvite(msg *models.Message, senderPeer peer.ID) error {
	log.Printf("🎮 Received game invite from %s", senderPeer)

	// Extract invitation data
	hostName, _ := msg.GetData("host_name")
	timeControl, _ := msg.GetData("time_control")
	inviteMessage, _ := msg.GetData("message")

	// Create invitation data for frontend
	inviteData := map[string]interface{}{
		"game_id":      msg.GameID,
		"host_name":    hostName,
		"host_peer_id": senderPeer.String(),
		"time_control": timeControl,
		"message":      inviteMessage,
	}

	// Notify frontend about the invitation
	p.gameService.NotifyFrontend("game_invite", inviteData)

	return nil
}

// handleGameJoin handles game join requests
func (p *P2PService) handleGameJoin(msg *models.Message, senderPeer peer.ID) error {
	log.Printf("👤 Received game join request from %s for game %s", senderPeer, msg.GameID)

	// Get player name from message
	playerName, _ := msg.GetData("player_name")
	playerNameStr, _ := playerName.(string)

	// Try to join the game
	game, err := p.gameService.JoinGame(msg.GameID, senderPeer.String(), playerNameStr)
	if err != nil {
		// Send error response
		errorMsg := models.CreateErrorMessage(
			p.host.ID().String(),
			msg.GameID,
			"JOIN_FAILED",
			err.Error(),
			"",
		)
		return p.SendMessage(senderPeer, errorMsg)
	}

	// Send acceptance response
	acceptMsg := models.NewMessage(models.MessageTypeGameAccept, p.host.ID().String(), msg.GameID)
	acceptMsg.SetData("game", game)
	return p.SendMessage(senderPeer, acceptMsg)
}

// handleGameAccept handles game acceptance messages
func (p *P2PService) handleGameAccept(msg *models.Message, senderPeer peer.ID) error {
	log.Printf("✅ Game accepted by %s", senderPeer)

	// Extract game data
	gameData, exists := msg.GetData("game")
	if !exists {
		return fmt.Errorf("no game data in accept message")
	}

	// Convert to game struct
	gameBytes, err := json.Marshal(gameData)
	if err != nil {
		return fmt.Errorf("failed to marshal game data: %w", err)
	}

	game, err := models.FromJSON(gameBytes)
	if err != nil {
		return fmt.Errorf("failed to parse game data: %w", err)
	}

	// Update local game state
	p.gameService.UpdateGame(game)

	// Notify frontend
	p.gameService.NotifyFrontend("game_start", map[string]interface{}{
		"game": game,
	})

	return nil
}

// handleGameDecline handles game decline messages
func (p *P2PService) handleGameDecline(msg *models.Message, senderPeer peer.ID) error {
	log.Printf("❌ Game declined by %s", senderPeer)

	reason, _ := msg.GetData("reason")

	// Notify frontend
	p.gameService.NotifyFrontend("game_decline", map[string]interface{}{
		"game_id": msg.GameID,
		"peer_id": senderPeer.String(),
		"reason":  reason,
	})

	return nil
}

// handleGameStart handles game start messages
func (p *P2PService) handleGameStart(msg *models.Message, senderPeer peer.ID) error {
	log.Printf("🚀 Game starting for game %s", msg.GameID)

	// Extract game data
	gameData, exists := msg.GetData("game")
	if !exists {
		return fmt.Errorf("no game data in start message")
	}

	// Convert to game struct
	gameBytes, err := json.Marshal(gameData)
	if err != nil {
		return fmt.Errorf("failed to marshal game data: %w", err)
	}

	game, err := models.FromJSON(gameBytes)
	if err != nil {
		return fmt.Errorf("failed to parse game data: %w", err)
	}

	// Update local game state
	p.gameService.UpdateGame(game)

	// Notify frontend
	p.gameService.NotifyFrontend("game_start", map[string]interface{}{
		"game": game,
	})

	return nil
}

// handleMove handles move messages
func (p *P2PService) handleMove(msg *models.Message, senderPeer peer.ID) error {
	log.Printf("♟️ Received move from %s for game %s", senderPeer, msg.GameID)

	// Extract move data
	moveData, exists := msg.GetData("move")
	if !exists {
		return fmt.Errorf("no move data in message")
	}

	// Convert to move struct
	moveBytes, err := json.Marshal(moveData)
	if err != nil {
		return fmt.Errorf("failed to marshal move data: %w", err)
	}

	var move models.Move
	if err := json.Unmarshal(moveBytes, &move); err != nil {
		return fmt.Errorf("failed to parse move data: %w", err)
	}

	// Process the move
	game, err := p.gameService.ProcessMove(msg.GameID, &move)
	if err != nil {
		// Send error response
		errorMsg := models.CreateErrorMessage(
			p.host.ID().String(),
			msg.GameID,
			"INVALID_MOVE",
			err.Error(),
			"",
		)
		return p.SendMessage(senderPeer, errorMsg)
	}

	// Send move response
	responseMsg := models.NewMessage(models.MessageTypeMoveResponse, p.host.ID().String(), msg.GameID)
	responseMsg.SetData("status", "accepted")
	responseMsg.SetData("game", game)
	if err := p.SendMessage(senderPeer, responseMsg); err != nil {
		log.Printf("Failed to send move response: %v", err)
	}

	// Notify frontend
	p.gameService.NotifyFrontend("move", map[string]interface{}{
		"move": &move,
		"game": game,
	})

	return nil
}

// handleMoveResponse handles move response messages
func (p *P2PService) handleMoveResponse(msg *models.Message, senderPeer peer.ID) error {
	log.Printf("📝 Received move response from %s", senderPeer)

	status, _ := msg.GetData("status")
	gameData, _ := msg.GetData("game")

	if status == "accepted" && gameData != nil {
		// Convert to game struct
		gameBytes, err := json.Marshal(gameData)
		if err != nil {
			return fmt.Errorf("failed to marshal game data: %w", err)
		}

		game, err := models.FromJSON(gameBytes)
		if err != nil {
			return fmt.Errorf("failed to parse game data: %w", err)
		}

		// Update local game state
		p.gameService.UpdateGame(game)

		// Notify frontend
		p.gameService.NotifyFrontend("move_accepted", map[string]interface{}{
			"game": game,
		})
	}

	return nil
}

// handleGameState handles game state sync messages
func (p *P2PService) handleGameState(msg *models.Message, senderPeer peer.ID) error {
	log.Printf("🔄 Received game state from %s", senderPeer)

	// Extract game data
	gameData, exists := msg.GetData("game")
	if !exists {
		return fmt.Errorf("no game data in state message")
	}

	// Convert to game struct
	gameBytes, err := json.Marshal(gameData)
	if err != nil {
		return fmt.Errorf("failed to marshal game data: %w", err)
	}

	game, err := models.FromJSON(gameBytes)
	if err != nil {
		return fmt.Errorf("failed to parse game data: %w", err)
	}

	// Update local game state
	p.gameService.UpdateGame(game)

	// Notify frontend
	p.gameService.NotifyFrontend("game_state", map[string]interface{}{
		"game": game,
	})

	return nil
}

// handleGameSync handles game synchronization requests
func (p *P2PService) handleGameSync(msg *models.Message, senderPeer peer.ID) error {
	log.Printf("🔄 Received sync request from %s for game %s", senderPeer, msg.GameID)

	// Get current game state
	game := p.gameService.GetGame(msg.GameID)
	if game == nil {
		return fmt.Errorf("game not found: %s", msg.GameID)
	}

	// Send current game state
	stateMsg := models.CreateGameStateMessage(p.host.ID().String(), game)
	return p.SendMessage(senderPeer, stateMsg)
}

// handlePing handles ping messages
func (p *P2PService) handlePing(msg *models.Message, senderPeer peer.ID) error {
	// Send pong response
	pongMsg := models.CreatePongMessage(p.host.ID().String())
	return p.SendMessage(senderPeer, pongMsg)
}

// handlePong handles pong messages
func (p *P2PService) handlePong(msg *models.Message, senderPeer peer.ID) error {
	// Update peer last seen
	p.peersMutex.Lock()
	defer p.peersMutex.Unlock()

	if peerInfo, exists := p.peers[senderPeer]; exists {
		peerInfo.LastSeen = msg.Timestamp
	}

	return nil
}

// handleDisconnect handles disconnect messages
func (p *P2PService) handleDisconnect(msg *models.Message, senderPeer peer.ID) error {
	log.Printf("🔌 Peer %s disconnecting", senderPeer)

	// Mark peer as disconnected
	p.removePeer(senderPeer)

	// Update player status in games
	games := p.gameService.GetGamesByPeer(senderPeer.String())
	for _, game := range games {
		game.SetPlayerOnlineStatus(senderPeer.String(), false)
		p.gameService.UpdateGame(game)

		// Notify frontend
		p.gameService.NotifyFrontend("player_disconnect", map[string]interface{}{
			"game_id": game.ID,
			"peer_id": senderPeer.String(),
		})
	}

	return nil
}

// handleReconnect handles reconnect messages
func (p *P2PService) handleReconnect(msg *models.Message, senderPeer peer.ID) error {
	log.Printf("🔄 Peer %s reconnecting", senderPeer)

	// Add peer back
	p.addPeer(senderPeer)

	// Update player status in games
	games := p.gameService.GetGamesByPeer(senderPeer.String())
	for _, game := range games {
		game.SetPlayerOnlineStatus(senderPeer.String(), true)
		p.gameService.UpdateGame(game)

		// Send current game state to reconnected peer
		stateMsg := models.CreateGameStateMessage(p.host.ID().String(), game)
		if err := p.SendMessage(senderPeer, stateMsg); err != nil {
			log.Printf("Failed to send game state to reconnected peer: %v", err)
		}

		// Notify frontend
		p.gameService.NotifyFrontend("player_reconnect", map[string]interface{}{
			"game_id": game.ID,
			"peer_id": senderPeer.String(),
		})
	}

	return nil
}

// handlePlayerUpdate handles player update messages
func (p *P2PService) handlePlayerUpdate(msg *models.Message, senderPeer peer.ID) error {
	log.Printf("👤 Received player update from %s", senderPeer)

	updateData, exists := msg.GetData("player_update")
	if !exists {
		return fmt.Errorf("no player update data")
	}

	// Convert to player update struct
	updateBytes, err := json.Marshal(updateData)
	if err != nil {
		return fmt.Errorf("failed to marshal player update data: %w", err)
	}

	var update models.PlayerUpdateData
	if err := json.Unmarshal(updateBytes, &update); err != nil {
		return fmt.Errorf("failed to parse player update data: %w", err)
	}

	// Update peer info
	p.peersMutex.Lock()
	if peerInfo, exists := p.peers[senderPeer]; exists {
		peerInfo.Connected = update.IsOnline
		if update.Name != "" {
			peerInfo.Name = update.Name
		}
	}
	p.peersMutex.Unlock()

	// Notify frontend
	p.gameService.NotifyFrontend("player_update", map[string]interface{}{
		"player_update": update,
	})

	return nil
}

// handleError handles error messages
func (p *P2PService) handleError(msg *models.Message, senderPeer peer.ID) error {
	log.Printf("❌ Received error from %s", senderPeer)

	errorData, exists := msg.GetData("error")
	if !exists {
		return fmt.Errorf("no error data in message")
	}

	// Notify frontend
	p.gameService.NotifyFrontend("error", map[string]interface{}{
		"error":   errorData,
		"peer_id": senderPeer.String(),
	})

	return nil
}

// handleResign handles resignation messages
func (p *P2PService) handleResign(msg *models.Message, senderPeer peer.ID) error {
	log.Printf("🏳️ Player %s resigned from game %s", senderPeer, msg.GameID)

	// Process resignation
	game, err := p.gameService.ResignGame(msg.GameID, senderPeer.String())
	if err != nil {
		return fmt.Errorf("failed to process resignation: %w", err)
	}

	// Notify frontend
	p.gameService.NotifyFrontend("resignation", map[string]interface{}{
		"game":    game,
		"peer_id": senderPeer.String(),
	})

	return nil
}

// handleDrawOffer handles draw offer messages
func (p *P2PService) handleDrawOffer(msg *models.Message, senderPeer peer.ID) error {
	log.Printf("🤝 Received draw offer from %s for game %s", senderPeer, msg.GameID)

	drawData, exists := msg.GetData("draw_offer")
	if !exists {
		return fmt.Errorf("no draw offer data")
	}

	// Notify frontend
	p.gameService.NotifyFrontend("draw_offer", map[string]interface{}{
		"draw_offer": drawData,
		"peer_id":    senderPeer.String(),
	})

	return nil
}

// handleDrawResponse handles draw response messages
func (p *P2PService) handleDrawResponse(msg *models.Message, senderPeer peer.ID) error {
	log.Printf("📝 Received draw response from %s", senderPeer)

	accepted, _ := msg.GetData("accepted")
	reason, _ := msg.GetData("reason")

	if accepted == true {
		// Process draw
		game, err := p.gameService.DrawGame(msg.GameID)
		if err != nil {
			return fmt.Errorf("failed to process draw: %w", err)
		}

		// Notify frontend
		p.gameService.NotifyFrontend("game_draw", map[string]interface{}{
			"game":   game,
			"reason": reason,
		})
	} else {
		// Notify frontend of declined draw
		p.gameService.NotifyFrontend("draw_declined", map[string]interface{}{
			"game_id": msg.GameID,
			"reason":  reason,
		})
	}

	return nil
}
