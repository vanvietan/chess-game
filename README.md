# Chess Game - Pure Frontend

A simple, elegant chess game built with vanilla JavaScript. Play against a friend or against a basic AI opponent.

## ✨ Features

- 🎮 **Human vs Human** - Play with a friend on the same device
- 🤖 **Human vs AI** - Play against Stockfish 17 engine via Chess-API.com
- 🎨 **Beautiful UI** - Clean, modern chess board design
- 📱 **Responsive** - Works on desktop and mobile devices
- ⚡ **Fast & Simple** - Pure frontend, no backend required

## 🚀 Live Demo

[Play Chess Now](https://your-vercel-app.vercel.app) *(Replace with your actual Vercel URL)*

## 🎯 How to Play

1. Click "New Game (PvP)" to start a game with a friend
2. Click "Play vs AI" to play against the computer
3. Click on a piece to select it, then click on a valid square to move
4. The game alternates between white and black players

## 🛠️ Local Development

Simply open `index.html` in your web browser - no build process or server required!

```bash
# Clone the repository
git clone https://github.com/vanvietan/chess-game.git

# Open in your browser
open index.html
```

## 📂 Project Structure

```
chess-game/
├── index.html      # Main HTML page
├── frontend.js     # Chess game logic
├── styles.css      # Styling and animations
├── vercel.json     # Vercel deployment config
└── README.md       # You are here
```

## 🎨 Features Overview

### Game Modes
- **PvP Mode**: Two players take turns on the same device
- **AI Mode**: Play against a randomized AI opponent

### Chess Board
- Standard 8x8 chess board with proper piece placement
- Visual highlighting for selected pieces and valid moves
- Smooth animations and hover effects

### User Interface
- Clean, modern design with gradient backgrounds
- Responsive layout that works on all screen sizes
- Intuitive controls with clear visual feedback

## 🚀 Deployment

This chess game is designed to be deployed easily on any static hosting service:

### Vercel (Recommended)
1. Connect your GitHub repository to Vercel
2. Deploy automatically - no configuration needed!

### Netlify
1. Drag and drop the project folder to Netlify
2. Your chess game is live instantly

### GitHub Pages
1. Enable GitHub Pages in your repository settings
2. Select "Deploy from a branch" and choose `main`

## 🔧 Technical Details

- **Pure JavaScript** - No frameworks or dependencies
- **CSS Grid** - For perfect chess board layout
- **CSS Animations** - Smooth piece movements and highlights
- **Responsive Design** - Mobile-friendly interface

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
4. **Fallback**: Uses random moves if API is unavailable

### **🎯 Smart Features:**
- **Adaptive Thinking Time**: Higher difficulty = longer analysis
- **Real Evaluations**: See position scores (centipawns)
- **Progressive Difficulty**: From beginner to super-GM strength

## 📱 Browser Compatibility

- ✅ Chrome (recommended)
- ✅ Firefox
- ✅ Safari
- ✅ Edge

## 🤝 Contributing

Contributions are welcome! Here are some ideas for improvements:

- [ ] Add proper chess rule validation
- [ ] Implement checkmate/stalemate detection
- [ ] Add move history and undo functionality
- [ ] Improve AI with basic strategy
- [ ] Add sound effects
- [ ] Add different board themes

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## 🏆 Acknowledgments

- Chess piece Unicode symbols for clean piece representation
- CSS Grid for perfect board layout
- Vanilla JavaScript for simplicity and performance

---

Made with ♟️ and ❤️ - Enjoy your game!