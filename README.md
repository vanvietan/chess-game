# Chess Game - Multiplayer P2P Edition

A feature-rich chess game with **P2P multiplayer support** powered by Go backend and libp2p networking. Play against friends online or challenge our advanced Stockfish AI.

## ✨ Features

### 🎮 **Game Modes**
- 🤖 **Human vs AI** - Challenge Stockfish 17 engine (2350-2750+ FIDE Elo)
- 👥 **P2P Multiplayer** - Play with friends via peer-to-peer networking  
- 🏠 **Local Multiplayer** - Play on the same device
- 🌐 **Real-time Sync** - Instant move synchronization across players

### 🚀 **Technical Features**
- 📡 **P2P Networking** - Libp2p for decentralized multiplayer
- 🔌 **WebSocket Real-time** - Instant game state updates
- 🎨 **Beautiful UI** - Clean, modern chess board design
- 📱 **Responsive** - Works on desktop and mobile devices
- 🔊 **Sound Effects** - Audio feedback for moves and game events
- ⚡ **Professional AI** - Powered by Chess-API.com Stockfish 17

## 🚀 Quick Start

### Option 1: Run with Go Backend (Recommended for Multiplayer)

```bash
# Clone the repository
git clone https://github.com/vanvietan/chess-game.git
cd chess-game

# Run the Go server
go run main.go

# Open in browser
open http://localhost:8080
```

### Option 2: Frontend Only (AI + Local Play)

```bash
# Simply open the HTML file
open index.html
```

## 🎯 How to Play

### **🤖 Single Player (AI Mode)**
1. Click "**Play vs AI**" 
2. Choose difficulty (1-20) and your color
3. Play against professional-strength Stockfish engine

### **👥 Multiplayer P2P Mode**
1. Click "**P2P Multiplayer**" to create a game
2. Share your **Peer ID** with your opponent  
3. Your friend connects using your Peer ID
4. Play real-time chess with instant synchronization

### **🏠 Local Multiplayer**
1. Click "**Human vs Human**"
2. Take turns on the same device

## 📂 Project Structure

```
chess-game/
├── main.go                    # Go server entry point
├── go.mod                     # Go dependencies
├── backend/                   # Go backend source
│   ├── handlers/
│   │   └── server.go          # HTTP handlers & routing
│   ├── models/
│   │   ├── game.go           # Chess game models
│   │   └── messages.go       # P2P message types
│   └── services/
│       ├── game.go           # Game state management
│       ├── p2p.go            # P2P networking (libp2p)
│       ├── p2p_handlers.go   # P2P message handlers
│       └── websocket.go      # WebSocket server
├── frontend.js                # Enhanced frontend with P2P
├── index.html                 # Main HTML page
├── styles.css                 # Styling and animations
└── README.md                  # You are here
```

## 🏗️ Architecture Overview

### **Backend (Go)**
- **🔗 P2P Networking**: libp2p for decentralized peer connections
- **🔌 WebSocket Server**: Real-time frontend ↔ backend communication  
- **🎮 Game Engine**: Complete chess game logic with multiplayer support
- **📡 Message System**: Structured P2P message passing

### **Frontend (JavaScript)**
- **🎨 Chess UI**: Interactive board with drag/click controls
- **🔌 WebSocket Client**: Real-time server communication
- **🤖 AI Integration**: Chess-API.com Stockfish 17 engine
- **🎵 Audio**: Sound effects for game events

## 🚀 Deployment Options

### **Local Development**
```bash
# Start Go backend
go run main.go

# Access at http://localhost:8080
```

### **Production Deployment**
```bash
# Build the binary
go build -o chess-server

# Deploy binary + static files to any server
./chess-server -port=8080
```

### **Static Frontend Only (No P2P)**
- Deploy `index.html`, `frontend.js`, `styles.css` to any static host
- AI and local multiplayer will work without backend

## 🤖 Stockfish AI Integration

The AI opponent uses the powerful **Stockfish 17 engine** via [Chess-API.com](https://chess-api.com):

### **🔥 AI Strength:**
- **Depth 1-18**: Maps to difficulty levels 1-20
- **Depth 12**: ~2350 FIDE Elo (International Master level)  
- **Depth 18**: ~2750 FIDE Elo (Grandmaster level)

### **⚡ How It Works:**
1. **Position Analysis**: Converts current board to FEN notation
2. **Stockfish Calculation**: Sends position to Chess-API.com  
3. **Best Move**: Receives optimal move with evaluation
4. **Fallback**: Uses basic AI if API is unavailable

### **🎯 Smart Features:**
- **Adaptive Thinking Time**: Higher difficulty = longer analysis
- **Real Evaluations**: See position scores (centipawns)
- **Progressive Difficulty**: From beginner to super-GM strength

## 🌐 P2P Multiplayer Technical Details

### **🔗 Networking Stack**
- **libp2p**: Decentralized peer-to-peer networking
- **WebSocket**: Frontend ↔ Backend real-time communication
- **Message Protocol**: Structured JSON message passing

### **🎮 Game Flow**
1. **Host creates game** → Generates unique Peer ID
2. **Opponent joins** → Connects via Peer ID  
3. **Real-time sync** → Moves instantly synchronized
4. **P2P direct** → No central server dependency

### **📡 Message Types**
- `create_game` - Host creates multiplayer game
- `join_game` - Join existing game via Peer ID
- `make_move` - Send chess moves to opponent
- `game_state` - Sync complete game state
- `resign`/`draw_offer` - Game ending actions

## 🔧 Technical Requirements

### **Runtime Dependencies**
- **Go 1.21+** - For backend server
- **Modern Browser** - Chrome/Firefox/Safari/Edge

### **Go Dependencies**
```go
github.com/gorilla/websocket      // WebSocket server
github.com/libp2p/go-libp2p       // P2P networking  
github.com/google/uuid            // UUID generation
```

## 📱 Browser Compatibility

- ✅ **Chrome** (recommended)
- ✅ **Firefox** 
- ✅ **Safari**
- ✅ **Edge**

## 🤝 Contributing

Contributions welcome! Areas for improvement:

### **🎮 Game Features**
- [ ] Tournament bracket system
- [ ] Spectator mode
- [ ] Game replay system
- [ ] Different time controls

### **🌐 Networking**
- [ ] Automatic peer discovery (mDNS)
- [ ] NAT traversal improvements
- [ ] Connection recovery
- [ ] Multiple simultaneous games

### **🎨 UI/UX**
- [ ] Board themes and piece sets
- [ ] Move animation improvements  
- [ ] Mobile touch optimizations
- [ ] Game analysis tools

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## 🏆 Acknowledgments

- **Chess-API.com** - Professional Stockfish 17 engine
- **libp2p** - Decentralized networking protocol
- **chess.js** - Chess game logic validation
- **chessboard.js** - Interactive chess board UI

---

Made with ♟️ and ❤️ - **Now with P2P multiplayer!** 🌐
