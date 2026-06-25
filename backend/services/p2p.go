package services

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/libp2p/go-libp2p"
	"github.com/libp2p/go-libp2p/core/host"
	"github.com/libp2p/go-libp2p/core/network"
	"github.com/libp2p/go-libp2p/core/peer"
	"github.com/libp2p/go-libp2p/core/protocol"

	"chess-game/backend/models"
)

const (
	// Protocol ID for our chess game
	ChessProtocolID protocol.ID = "/chess-game/1.0.0"
	// mDNS service name
	ServiceName = "chess-game"
)

// P2PService handles peer-to-peer networking for the chess game
type P2PService struct {
	ctx             context.Context
	host            host.Host
	gameService     *GameService
	peers           map[peer.ID]*PeerInfo
	peersMutex      sync.RWMutex
	messageHandlers map[models.MessageType]MessageHandler
	isHost          bool
}

// PeerInfo contains information about a connected peer
type PeerInfo struct {
	ID        peer.ID   `json:"id"`
	Name      string    `json:"name"`
	Connected bool      `json:"connected"`
	LastSeen  time.Time `json:"last_seen"`
	GameIDs   []string  `json:"game_ids"`
}

// MessageHandler is a function type for handling different message types
type MessageHandler func(*models.Message, peer.ID) error

// NewP2PService creates a new P2P service
func NewP2PService(ctx context.Context, gameService *GameService) (*P2PService, error) {
	// Create the libp2p host with basic configuration
	h, err := libp2p.New(
		libp2p.ListenAddrStrings("/ip4/0.0.0.0/tcp/0"),
		libp2p.NATPortMap(),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create libp2p host: %w", err)
	}

	service := &P2PService{
		ctx:             ctx,
		host:            h,
		gameService:     gameService,
		peers:           make(map[peer.ID]*PeerInfo),
		messageHandlers: make(map[models.MessageType]MessageHandler),
		isHost:          true, // Default to host
	}

	// Set up stream handler
	h.SetStreamHandler(ChessProtocolID, service.handleStream)

	// Initialize message handlers
	service.initMessageHandlers()

	log.Printf("🚀 P2P service started!")
	log.Printf("📡 Host ID: %s", h.ID())
	log.Printf("🌐 Listening addresses:")
	for _, addr := range h.Addrs() {
		log.Printf("   %s/p2p/%s", addr, h.ID())
	}

	return service, nil
}

// initMessageHandlers sets up handlers for different message types
func (p *P2PService) initMessageHandlers() {
	p.messageHandlers[models.MessageTypeGameInvite] = p.handleGameInvite
	p.messageHandlers[models.MessageTypeGameJoin] = p.handleGameJoin
	p.messageHandlers[models.MessageTypeGameAccept] = p.handleGameAccept
	p.messageHandlers[models.MessageTypeGameDecline] = p.handleGameDecline
	p.messageHandlers[models.MessageTypeGameStart] = p.handleGameStart
	p.messageHandlers[models.MessageTypeMove] = p.handleMove
	p.messageHandlers[models.MessageTypeMoveResponse] = p.handleMoveResponse
	p.messageHandlers[models.MessageTypeGameState] = p.handleGameState
	p.messageHandlers[models.MessageTypeGameSync] = p.handleGameSync
	p.messageHandlers[models.MessageTypePing] = p.handlePing
	p.messageHandlers[models.MessageTypePong] = p.handlePong
	p.messageHandlers[models.MessageTypeDisconnect] = p.handleDisconnect
	p.messageHandlers[models.MessageTypeReconnect] = p.handleReconnect
	p.messageHandlers[models.MessageTypePlayerUpdate] = p.handlePlayerUpdate
	p.messageHandlers[models.MessageTypeError] = p.handleError
	p.messageHandlers[models.MessageTypeResign] = p.handleResign
	p.messageHandlers[models.MessageTypeDrawOffer] = p.handleDrawOffer
	p.messageHandlers[models.MessageTypeDrawResponse] = p.handleDrawResponse
}

// handleStream handles incoming streams from peers
func (p *P2PService) handleStream(stream network.Stream) {
	defer stream.Close()

	remotePeer := stream.Conn().RemotePeer()
	log.Printf("📨 New stream from peer: %s", remotePeer)

	// Add peer to our list
	p.addPeer(remotePeer)

	// Create a buffered reader
	reader := bufio.NewReader(stream)

	for {
		// Read message
		msgBytes, err := reader.ReadBytes('\n')
		if err != nil {
			log.Printf("Error reading from stream: %v", err)
			break
		}

		// Parse message
		var msg models.Message
		if err := json.Unmarshal(msgBytes, &msg); err != nil {
			log.Printf("Error parsing message: %v", err)
			continue
		}

		// Handle message
		if err := p.handleMessage(&msg, remotePeer); err != nil {
			log.Printf("Error handling message: %v", err)
		}
	}

	// Mark peer as disconnected
	p.removePeer(remotePeer)
}

// handleMessage routes messages to appropriate handlers
func (p *P2PService) handleMessage(msg *models.Message, senderPeer peer.ID) error {
	log.Printf("📧 Received message type: %s from peer: %s", msg.Type, senderPeer)

	handler, exists := p.messageHandlers[msg.Type]
	if !exists {
		return fmt.Errorf("no handler for message type: %s", msg.Type)
	}

	return handler(msg, senderPeer)
}

// SendMessage sends a message to a specific peer
func (p *P2PService) SendMessage(peerID peer.ID, msg *models.Message) error {
	stream, err := p.host.NewStream(p.ctx, peerID, ChessProtocolID)
	if err != nil {
		return fmt.Errorf("failed to create stream to peer %s: %w", peerID, err)
	}
	defer stream.Close()

	msgBytes, err := json.Marshal(msg)
	if err != nil {
		return fmt.Errorf("failed to marshal message: %w", err)
	}

	// Add newline delimiter
	msgBytes = append(msgBytes, '\n')

	_, err = stream.Write(msgBytes)
	if err != nil {
		return fmt.Errorf("failed to write message: %w", err)
	}

	log.Printf("📤 Sent message type: %s to peer: %s", msg.Type, peerID)
	return nil
}

// BroadcastMessage sends a message to all connected peers
func (p *P2PService) BroadcastMessage(msg *models.Message) {
	p.peersMutex.RLock()
	defer p.peersMutex.RUnlock()

	for peerID, peerInfo := range p.peers {
		if peerInfo.Connected {
			if err := p.SendMessage(peerID, msg); err != nil {
				log.Printf("Failed to send message to peer %s: %v", peerID, err)
			}
		}
	}
}

// addPeer adds a peer to the peer list
func (p *P2PService) addPeer(peerID peer.ID) {
	p.peersMutex.Lock()
	defer p.peersMutex.Unlock()

	if _, exists := p.peers[peerID]; !exists {
		p.peers[peerID] = &PeerInfo{
			ID:        peerID,
			Connected: true,
			LastSeen:  time.Now(),
			GameIDs:   []string{},
		}
		log.Printf("➕ Added peer: %s", peerID)
	} else {
		p.peers[peerID].Connected = true
		p.peers[peerID].LastSeen = time.Now()
		log.Printf("🔄 Reconnected peer: %s", peerID)
	}
}

// removePeer marks a peer as disconnected
func (p *P2PService) removePeer(peerID peer.ID) {
	p.peersMutex.Lock()
	defer p.peersMutex.Unlock()

	if peerInfo, exists := p.peers[peerID]; exists {
		peerInfo.Connected = false
		peerInfo.LastSeen = time.Now()
		log.Printf("➖ Disconnected peer: %s", peerID)
	}
}

// GetConnectedPeers returns a list of connected peers
func (p *P2PService) GetConnectedPeers() []*PeerInfo {
	p.peersMutex.RLock()
	defer p.peersMutex.RUnlock()

	var peers []*PeerInfo
	for _, peerInfo := range p.peers {
		if peerInfo.Connected {
			peers = append(peers, peerInfo)
		}
	}
	return peers
}

// GetHostID returns the host peer ID
func (p *P2PService) GetHostID() peer.ID {
	return p.host.ID()
}

// ConnectToPeer attempts to connect to a peer by multiaddr
func (p *P2PService) ConnectToPeer(peerAddr string) error {
	// Parse the multiaddr
	maddr, err := peer.AddrInfoFromString(peerAddr)
	if err != nil {
		return fmt.Errorf("failed to parse peer address: %w", err)
	}

	// Connect to the peer
	if err := p.host.Connect(p.ctx, *maddr); err != nil {
		return fmt.Errorf("failed to connect to peer: %w", err)
	}

	log.Printf("🔗 Connected to peer: %s", maddr.ID)
	return nil
}

// Close closes the P2P service
func (p *P2PService) Close() error {
	return p.host.Close()
}
