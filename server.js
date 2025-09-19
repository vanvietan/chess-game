const express = require('express');
const { spawn } = require('child_process');
const path = require('path');

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());
app.use(express.static('.'));

// Stockfish engine instance
let stockfish = null;

// Initialize Stockfish
function initializeStockfish() {
    stockfish = spawn('stockfish');
    
    stockfish.stdin.write('uci\n');
    stockfish.stdin.write('isready\n');
    
    stockfish.stdout.on('data', (data) => {
        console.log('Stockfish:', data.toString());
    });
    
    stockfish.stderr.on('data', (data) => {
        console.error('Stockfish error:', data.toString());
    });
}

// API endpoint to get AI move
app.post('/api/ai-move', (req, res) => {
    const { fen, difficulty } = req.body;
    
    if (!stockfish) {
        return res.status(500).json({ error: 'Stockfish not initialized' });
    }
    
    // Set difficulty (skill level 0-20)
    stockfish.stdin.write(`setoption name Skill Level value ${difficulty}\n`);
    
    // Set position
    stockfish.stdin.write(`position fen ${fen}\n`);
    
    // Calculate move time based on difficulty
    const moveTime = Math.max(100, difficulty * 100);
    stockfish.stdin.write(`go movetime ${moveTime}\n`);
    
    // Listen for bestmove
    let responseHandler;
    const timeout = setTimeout(() => {
        stockfish.stdout.removeListener('data', responseHandler);
        res.status(500).json({ error: 'AI move timeout' });
    }, 10000);
    
    responseHandler = (data) => {
        const output = data.toString();
        const lines = output.split('\n');
        
        for (const line of lines) {
            if (line.startsWith('bestmove')) {
                clearTimeout(timeout);
                stockfish.stdout.removeListener('data', responseHandler);
                
                const moveMatch = line.match(/bestmove ([a-h][1-8][a-h][1-8])/);
                if (moveMatch) {
                    const move = moveMatch[1];
                    res.json({ 
                        move: move,
                        from: move.substring(0, 2),
                        to: move.substring(2, 4)
                    });
                } else {
                    res.status(500).json({ error: 'Invalid move from AI' });
                }
                return;
            }
        }
    };
    
    stockfish.stdout.on('data', responseHandler);
});

// Serve the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`Chess game server running on http://localhost:${PORT}`);
    console.log('Initializing Stockfish...');
    initializeStockfish();
});

// Cleanup on exit
process.on('SIGINT', () => {
    if (stockfish) {
        stockfish.kill();
    }
    process.exit();
});
