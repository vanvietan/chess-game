# ⚡ Chess Game - Quick Start

Your chess game is now configured to use **Chess-API.com exclusively** - no local Stockfish installation needed!

## 🚀 Start Playing (Choose One)

### Option 1: Simple Script
```bash
./start.sh
```

### Option 2: Make Command  
```bash
make run
```

### Option 3: Docker (Zero Dependencies)
```bash
make docker-simple
```

### Option 4: Direct Go
```bash
go run main.go
```

## 🎮 Access Your Game

Open your browser to: **http://localhost:8080**

## ✨ What You Get

- 🌐 **Chess-API.com Integration**: Powered by Stockfish 17 NNUE
- 🎯 **AI Difficulty**: 1-18 skill levels
- ⚡ **High Performance**: Go backend with WebSocket updates
- 🎮 **Multiple Modes**: Human vs Human or Human vs AI
- 📱 **Modern UI**: Clean, responsive interface

## 🎯 AI Configuration

When you click "Play vs AI":
- **AI Color**: Choose White, Black, or Random
- **Difficulty**: 1 (Easy) to 18 (Grandmaster level ~2750 ELO)
- **Depth**: Automatically optimized based on difficulty
- **Time**: Smart time allocation for better moves

## 🌐 Requirements

- ✅ **Internet connection** (for Chess-API.com)
- ✅ **Go 1.21+** (for local development)
- ✅ **Modern browser** (for the game interface)
- ❌ **No Stockfish installation needed!**

## 🔧 Configuration (Optional)

The application works out-of-the-box, but you can customize:

```bash
export PORT=8080                              # Server port
export CHESS_API_URL=https://chess-api.com/v1 # API endpoint
```

## 🚨 Troubleshooting

### If the server won't start:
```bash
# Check if port is in use
lsof -ti:8080 | xargs kill -9

# Or use different port
export PORT=8081 && ./start.sh
```

### If AI moves are slow:
- Check your internet connection
- Try lower difficulty (1-10 for faster responses)
- Chess-API.com may have rate limits during peak usage

### If you see errors:
```bash
# Check application health
curl http://localhost:8080/api/health

# Check Chess-API.com connectivity  
curl https://chess-api.com/v1
```

## 📊 Performance Notes

- **Startup**: ~2 seconds
- **AI Moves**: 200-1000ms (depends on difficulty & network)
- **UI Updates**: Real-time via WebSocket
- **Memory**: ~8MB (very lightweight)

---

**That's it!** Your chess game is ready to play with AI opponents powered by Chess-API.com! 🎉

**Next Steps:**
1. Run `./start.sh`
2. Open http://localhost:8080
3. Click "Play vs AI"
4. Choose your settings
5. Start playing! ♟️
