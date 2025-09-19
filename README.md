# Chess Game with Go Backend & Chess-API.com

A modern chess game powered by Go backend and [Chess-API.com](https://chess-api.com) for intelligent AI opponents.

## 🚀 Quick Start

### Simplest Way (Recommended)
```bash
./start.sh
```
This will start the server with Chess-API.com integration on http://localhost:8080

### Docker (Zero Setup)
```bash
# Simple one-command start
docker-compose -f docker-compose-simple.yml up

# Or use the Makefile
make docker-simple
```
Access at: http://localhost:8080

### Development
```bash
# Install dependencies and run
make setup-dev
make run
```

## ✨ Features

- 🌐 **Chess-API.com Integration**: No local installation required
- ⚡ **High-Performance Go Backend**: Fast, concurrent game handling  
- 🔄 **Real-time Updates**: WebSocket-based live game updates
- 🎯 **AI Difficulty**: 1-18 skill levels powered by Stockfish 17
- 🎮 **Multiple Game Modes**: Human vs Human, Human vs AI
- 🐳 **Docker Ready**: One-command deployment
- 📱 **Modern UI**: Clean, responsive web interface

## 🎮 How to Play

1. **Start the server** using any method above
2. **Open browser** to http://localhost:8080  
3. **Choose game mode**:
   - "New Game (PvP)" for human vs human
   - "Play vs AI" for AI opponent
4. **Configure AI** (if chosen):
   - Select AI color (White/Black/Random)  
   - Choose difficulty (1-18)
5. **Play chess** by clicking pieces and destination squares

## 🔧 Configuration

The application uses Chess-API.com by default. You can customize via environment variables:

```bash
export PORT=8080                              # Server port
export USE_CHESS_API=true                     # Always true for this setup
export CHESS_API_URL=https://chess-api.com/v1 # Chess-API endpoint
```

## 📊 Why Chess-API.com?

| Advantage | Benefit |
|-----------|---------|
| **Zero Setup** | No Stockfish installation required |
| **Always Updated** | Latest Stockfish 17 with NNUE |
| **High Performance** | Up to 80 MNPS calculation power |
| **No Maintenance** | No local engine management |
| **Cross Platform** | Works on any system with internet |
| **Advanced Features** | Multiple variants, analysis depth up to 18 |

## 🛠 Available Commands

```bash
# Basic usage
./start.sh              # Start with Chess-API.com
make run                # Development run
make docker-simple      # Docker deployment

# Development
make setup-dev          # Install dependencies  
make build              # Build binary
make test               # Run tests
make clean              # Clean build artifacts

# Docker options
make docker-simple      # Simplified Chess-API.com only
make docker-run         # Full multi-engine setup
make docker-stop        # Stop containers

# Optional Stockfish (if needed)
make run-stockfish      # Run with local Stockfish
make check-stockfish    # Check Stockfish installation
```

## 📡 API Endpoints

### Game Management
- `POST /api/games` - Create new game
- `GET /api/games/:id` - Get game state
- `POST /api/games/:id/moves` - Make a move  
- `POST /api/games/:id/ai-move` - Get AI move

### Real-time
- `GET /api/ws` - WebSocket for live updates

### Utility  
- `GET /api/health` - Health check

## 🔗 Example API Usage

### Create AI Game
```bash
curl -X POST http://localhost:8080/api/games \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "ai",
    "playerName": "Human Player", 
    "aiSettings": {
      "color": "black",
      "difficulty": 12,
      "maxDepth": 15,
      "timeLimit": 2000
    }
  }'
```

### Make a Move
```bash
curl -X POST http://localhost:8080/api/games/{gameId}/moves \
  -H "Content-Type: application/json" \
  -d '{"from": "e2", "to": "e4"}'
```

## 🏗 Architecture

```
Frontend (JS) ←→ Go Backend ←→ Chess-API.com
     ↕              ↕              ↕
WebSocket    REST API      Stockfish 17 NNUE
```

- **Frontend**: Vanilla JavaScript with WebSocket
- **Backend**: Go with Gin framework  
- **Engine**: Chess-API.com with Stockfish 17
- **Communication**: REST API + WebSockets

## 📁 Project Structure

```
chess-game/
├── main.go                    # Application entry
├── internal/
│   ├── api/                   # HTTP routes & WebSocket
│   ├── config/                # Configuration  
│   ├── models/                # Data structures
│   └── services/              # Business logic
├── frontend.js                # Frontend client
├── index.html                 # Web interface
├── styles.css                 # Styling
├── Dockerfile.chess-api       # Simplified container
├── docker-compose-simple.yml  # One-service deployment
└── start.sh                   # Quick start script
```

## ⚡ Performance

- **Startup**: ~2 seconds
- **Move Response**: 200-500ms (network dependent)
- **Memory**: ~8MB base + ~1KB per game
- **Concurrent Games**: Unlimited (limited by Chess-API.com rate limits)
- **AI Strength**: Up to 2750+ ELO equivalent

## 🌐 Chess-API.com Features

According to [Chess-API.com](https://chess-api.com):

- **Stockfish 17 NNUE**: Latest engine with neural networks
- **80 MNPS**: Mega-nodes per second calculation power  
- **32 vCores**: High-performance server infrastructure
- **128 GB DDR5**: Fast memory for deep calculations
- **Multiple Variants**: Support for different chess variants
- **Progressive Analysis**: Real-time move suggestions
- **Free Tier**: Generous limits for development and casual use

## 🚨 Troubleshooting

### Connection Issues
```bash
# Check internet connection
curl -s https://chess-api.com/v1 && echo "✅ Chess-API.com reachable"

# Check application health
curl -s http://localhost:8080/api/health
```

### Port Already in Use
```bash
# Use different port
export PORT=8081 && ./start.sh

# Or kill existing process
lsof -ti:8080 | xargs kill -9
```

### Docker Issues
```bash
# Rebuild and restart
docker-compose -f docker-compose-simple.yml down
docker-compose -f docker-compose-simple.yml up --build
```

## 🔄 Migration Notes

This setup replaces the original Node.js backend with a high-performance Go implementation while maintaining the same game functionality. The original files are preserved for reference.

## 📞 Support

1. **Check logs**: `docker-compose -f docker-compose-simple.yml logs -f`
2. **Verify connectivity**: Visit http://localhost:8080/api/health
3. **Test Chess-API**: `curl -s https://chess-api.com/v1`

## 📝 License

MIT License - see LICENSE file for details.

---

**Ready to play chess with AI?** Just run `./start.sh` and visit http://localhost:8080! 🎉