class ChessGameClient {
    constructor() {
        // Initialize chess.js game engine
        this.game = new Chess();
        
        // Game state
        this.gameId = null;
        this.gameMode = 'human';
        this.gameStatus = 'waiting';
        this.aiColor = 'black';
        this.aiDifficulty = 8;
        this.aiThinking = false;
        
        // UI state
        this.boardRotated = false;
        this.moveHistory = [];
        this.capturedPieces = { white: [], black: [] };
        this.showMoveHighlighting = true;
        this.soundEnabled = true;
        
        
        // Initialize
        this.initializeChessboard();
        this.attachEventListeners();
        this.updateUI();
        this.updateToggleButtonState();
        this.updateSoundButtonState();
        this.setupKeyboardNavigation();
        this.initializeSoundSystem();
    }
    
    initializeChessboard() {
        if (typeof Chessboard === 'undefined' || typeof Chess === 'undefined' || typeof $ === 'undefined') {
            setTimeout(() => this.initializeChessboard(), 100);
            return;
        }

        const boardElement = document.getElementById('chessboard');
        if (!boardElement) {
            setTimeout(() => this.initializeChessboard(), 100);
            return;
        }

        try {
            this.chessboard = Chessboard('chessboard', {
                draggable: true,
                position: 'start',
                onDragStart: this.onDragStart.bind(this),
                onDrop: this.onDrop.bind(this),
                onSnapEnd: this.onSnapEnd.bind(this),
                pieceTheme: 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png',
                showNotation: true,
                sparePieces: false
            });
            
        } catch (error) {
            setTimeout(() => this.initializeChessboard(), 500);
            return;
        }
        
        this.updateUI();
        }
        
    onDragStart(source, piece, position, orientation) {
        const currentPlayer = this.game.turn() === 'w' ? 'white' : 'black';
        const pieceColor = piece.charAt(0) === 'w' ? 'white' : 'black';
    
        if (pieceColor !== currentPlayer || this.game.game_over() || this.aiThinking) {
            return false;
        }
        
        return true;
    }
    
    onDrop(source, target, piece, newPos, oldPos, orientation) {
        // Check if this is a pawn promotion
        const isPawnPromotion = (piece.toLowerCase().includes('p') && 
            ((piece.charAt(0) === 'w' && target.charAt(1) === '8') ||
             (piece.charAt(0) === 'b' && target.charAt(1) === '1')));
        
        let promotionPiece = 'q'; // Default to queen
        
        // If it's a promotion, we could show a modal here (simplified to queen for now)
        if (isPawnPromotion) {
            // For now, always promote to queen. Could add promotion modal later
            promotionPiece = 'q';
        }
        
        const move = this.game.move({
            from: source,
            to: target,
            promotion: promotionPiece
        });
        
        if (move === null) {
            return 'snapback';
        }
        
        this.updateAfterMove(move);
        return true;
    }
    
    onSnapEnd() {
        this.chessboard.position(this.game.fen());
    }
    
    updateAfterMove(move) {
        this.addMoveToHistory(move);
        
        if (move.captured) {
            const capturedPiece = {
                type: move.captured,
                color: move.color === 'w' ? 'b' : 'w'
            };
            const captureColor = capturedPiece.color === 'w' ? 'white' : 'black';
            this.capturedPieces[captureColor].push(capturedPiece);
            this.playSound('capture');
        } else {
            this.playSound('move');
        }
        
        this.updateUI();
        this.updateMoveHighlighting(move);
        
        // Clear any error messages
        this.clearErrorMessage();
        
        // Check for game state sounds
        if (this.game.game_over()) {
            if (this.game.in_checkmate()) {
                this.playSound('checkmate');
            }
            this.handleGameOver();
            return;
        } else if (this.game.in_check()) {
            this.playSound('check');
        }
        
        if (this.gameMode === 'ai') {
            const currentPlayer = this.game.turn() === 'w' ? 'white' : 'black';
            if (currentPlayer === this.aiColor) {
                setTimeout(() => this.makeStockfishAIMove(), 500);
            }
        }
    }
    
    addMoveToHistory(move) {
        this.moveHistory.push({
            move: move.san,
            color: move.color === 'w' ? 'white' : 'black',
            moveNumber: Math.ceil(this.game.history().length / 2)
        });
        this.updateMoveHistoryDisplay();
    }
    
    updateMoveHistoryDisplay() {
        const historyElement = document.getElementById('move-history');
        if (!historyElement) return;
        
        historyElement.innerHTML = '';
        
        for (let i = 0; i < this.moveHistory.length; i += 2) {
            const moveNumber = Math.floor(i / 2) + 1;
            const whiteMove = this.moveHistory[i];
            const blackMove = this.moveHistory[i + 1];
            
            const moveNumberEl = document.createElement('div');
            moveNumberEl.className = 'move-number';
            moveNumberEl.textContent = moveNumber + '.';
            historyElement.appendChild(moveNumberEl);
            
            const whiteMoveEl = document.createElement('div');
            whiteMoveEl.className = 'move-white';
            whiteMoveEl.textContent = whiteMove ? whiteMove.move : '';
            historyElement.appendChild(whiteMoveEl);
            
            const blackMoveEl = document.createElement('div');
            blackMoveEl.className = 'move-black';
            blackMoveEl.textContent = blackMove ? blackMove.move : '';
            historyElement.appendChild(blackMoveEl);
        }
        
        historyElement.scrollTop = historyElement.scrollHeight;
    }
    
    updateMoveHighlighting(move) {
        if (!this.showMoveHighlighting) return;
        
        this.clearMoveHighlighting();
        
        setTimeout(() => {
            const fromSquare = document.querySelector('[data-square="' + move.from + '"]');
            const toSquare = document.querySelector('[data-square="' + move.to + '"]');
            
            if (fromSquare) fromSquare.classList.add('last-move');
            if (toSquare) toSquare.classList.add('last-move');
        }, 100);
    }
    
    clearMoveHighlighting() {
        document.querySelectorAll('.last-move').forEach(square => {
            square.classList.remove('last-move');
        });
    }
    
    toggleMoveHighlighting() {
        this.showMoveHighlighting = !this.showMoveHighlighting;
        this.updateToggleButtonState();
        
        if (!this.showMoveHighlighting) {
            this.clearMoveHighlighting();
        }
    }
    
    updateToggleButtonState() {
        const button = document.getElementById('toggle-move-highlight-btn');
        if (button) {
            if (this.showMoveHighlighting) {
                button.classList.add('active');
                button.title = 'Disable move highlighting';
        } else {
                button.classList.remove('active');
                button.title = 'Enable move highlighting';
            }
        }
    }
    
    createGame(mode = 'human', aiSettings = null) {
        this.gameId = 'local-' + Math.random().toString(36).substr(2, 9);
        this.gameMode = mode;
        this.gameStatus = 'playing';
        
        if (aiSettings) {
            this.aiColor = aiSettings.color;
            this.aiDifficulty = aiSettings.difficulty;
        }
        
        this.game.reset();
        this.moveHistory = [];
        this.capturedPieces = { white: [], black: [] };
        
        if (this.chessboard) {
            this.chessboard.position('start');
            console.log('Chessboard position set to start');
        } else {
            console.error('Chessboard not initialized when creating game');
            // Try to reinitialize
            this.initializeChessboard();
        return false;
    }
        
        this.updateUI();
        this.updateMoveHistoryDisplay();
        this.updateGameIdDisplay();
        this.clearMoveHighlighting();
        this.clearErrorMessage();
        
        // Play game start sound
        this.playSound('gameStart');
        
        if (mode === 'ai' && aiSettings && aiSettings.color === 'white') {
            if (this.chessboard) {
                this.chessboard.flip();
            }
            setTimeout(() => this.makeStockfishAIMove(), 1000);
        }
        
        return true;
    }
    
    async makeStockfishAIMove() {
        if (this.aiThinking || this.game.game_over()) return;
        
        this.aiThinking = true;
        this.updateUI();
        
        try {
            // Get current position in FEN format
            const fen = this.game.fen();
            const moves = this.game.moves({ verbose: true });
            
            if (moves.length === 0) {
                this.aiThinking = false;
                this.updateUI();
                return;
            }
            
            
            // Use real Stockfish 17 API from chess-api.com
            let bestMove;
            try {
                const apiResponse = await this.getStockfishMove(fen, this.aiDifficulty);
                if (apiResponse && apiResponse.move) {
                    // Convert API move format (e.g., "e2e4") to chess.js format
                    const fromSquare = apiResponse.move.substring(0, 2);
                    const toSquare = apiResponse.move.substring(2, 4);
                    const promotion = apiResponse.move.length > 4 ? apiResponse.move.substring(4) : undefined;
                    
                    // Try to make the move suggested by Stockfish
                    const moveObj = {
                        from: fromSquare,
                        to: toSquare
                    };
                    
                    if (promotion) {
                        moveObj.promotion = promotion;
                    }
                    
                    bestMove = this.game.move(moveObj);
                } else {
                    throw new Error('Invalid API response');
                }
            } catch (apiError) {
                // Fallback to basic AI if API fails
                bestMove = this.getBasicAIMove(moves);
            }
            
            if (bestMove) {
                this.chessboard.position(this.game.fen());
                this.updateAfterMove(bestMove);
                }
            
        } catch (error) {
            console.error('AI move error:', error);
        }
        
        this.aiThinking = false;
        this.updateUI();
    }
    
    async getStockfishMove(fen, difficulty) {
        try {
            // Map difficulty (1-20) to appropriate depth (1-18)
            const depth = Math.min(Math.max(difficulty, 1), 18);
            const maxThinkingTime = Math.min(50 + (difficulty * 2), 100);
            
            const response = await fetch("https://chess-api.com/v1", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    fen: fen,
                    depth: depth,
                    maxThinkingTime: maxThinkingTime,
                    variants: 1
                }),
            });
            
            if (!response.ok) {
                throw new Error(`API request failed: ${response.status}`);
            }
            
            const data = await response.json();
            return data;
            
        } catch (error) {
            console.error('Stockfish API error:', error);
            throw error;
        }
    }
    
    getBasicAIMove(moves) {
        // Fallback basic AI (same as before)
        const captureMove = moves.find(move => move.captured);
        const centerMoves = moves.filter(move => 
            ['e4', 'e5', 'd4', 'd5'].includes(move.to) || 
            ['e4', 'e5', 'd4', 'd5'].includes(move.from)
        );
        
        let selectedMove;
        if (captureMove) {
            selectedMove = captureMove;
        } else if (centerMoves.length > 0) {
            selectedMove = centerMoves[Math.floor(Math.random() * centerMoves.length)];
        } else {
            selectedMove = moves[Math.floor(Math.random() * moves.length)];
        }
        
        return this.game.move(selectedMove);
    }
    
    getStrengthDescription(evaluation) {
        if (evaluation === null || evaluation === undefined) return 'Unknown';
        
        const absEval = Math.abs(evaluation);
        if (absEval < 0.5) return 'Equal position';
        if (absEval < 1.5) return 'Slight advantage';
        if (absEval < 3.0) return 'Clear advantage';
        if (absEval < 6.0) return 'Winning position';
        return 'Decisive advantage';
    }
    
    getAILevelDescription(difficulty) {
        const depthLevel = Math.min(Math.max(difficulty, 1), 18);
        
        if (depthLevel <= 6) return 'Beginner';
        else if (depthLevel <= 10) return 'Club Player';
        else if (depthLevel <= 12) return 'International Master';
        else if (depthLevel <= 15) return 'Grandmaster';
        else return 'Super Grandmaster';
    }
    
    handleGameOver() {
        let status = '';
        
        if (this.game.in_checkmate()) {
            const winner = this.game.turn() === 'w' ? 'Black' : 'White';
            status = 'Checkmate! ' + winner + ' wins!';
        } else if (this.game.in_draw()) {
            if (this.game.in_stalemate()) {
                status = 'Draw by stalemate';
            } else if (this.game.in_threefold_repetition()) {
                status = 'Draw by repetition';
            } else if (this.game.insufficient_material()) {
                status = 'Draw by insufficient material';
            } else {
                status = 'Draw by 50-move rule';
            }
        }
        
        this.gameStatus = 'finished';
        this.updateUI();
        
        if (status) {
            setTimeout(() => alert(status), 100);
        }
    }
    
    rotateBoard() {
        this.boardRotated = !this.boardRotated;
        if (this.chessboard) {
            this.chessboard.flip();
        }
    }
    
    updateUI() {
        const currentPlayerEl = document.querySelector('.current-player span');
        if (currentPlayerEl) {
            const currentPlayer = this.game.turn() === 'w' ? 'White' : 'Black';
            currentPlayerEl.textContent = currentPlayer;
        }
        
        const gameStatusEl = document.querySelector('.game-status span');
        if (gameStatusEl) {
            let status = 'Ready to Play';
            
            if (this.gameStatus === 'playing') {
                if (this.aiThinking) {
                    const depthLevel = Math.min(Math.max(this.aiDifficulty, 1), 18);
                    const aiLevel = this.getAILevelDescription(this.aiDifficulty);
                    status = `AI Thinking... (${aiLevel} Level)`;
                } else if (this.game.in_check()) {
                    status = 'Check!';
                } else {
                    status = 'Playing';
                    
                    // Show AI level when playing against AI
                    if (this.gameMode === 'ai') {
                        const depthLevel = Math.min(Math.max(this.aiDifficulty, 1), 18);
                        const aiLevel = this.getAILevelDescription(this.aiDifficulty);
                        status = `Playing vs ${aiLevel} AI (Depth ${depthLevel})`;
                    }
                }
            } else if (this.gameStatus === 'finished') {
                status = 'Game Over';
            }
            
            gameStatusEl.textContent = status;
        }
        
        const gameModeEl = document.querySelector('.game-mode span');
        if (gameModeEl) {
            const mode = this.gameMode === 'ai' ? 'Human vs AI (' + this.aiColor + ')' : 'Human vs Human';
            gameModeEl.textContent = mode;
        }
        
        const aiInfoEl = document.querySelector('.ai-info span');
        if (aiInfoEl) {
            const depthLevel = Math.min(Math.max(this.aiDifficulty, 1), 18);
            const strengthDesc = this.getAILevelDescription(this.aiDifficulty);
            
            aiInfoEl.textContent = `AI: Stockfish 17 Depth ${depthLevel} (${strengthDesc})`;
        }
        
        this.updateCapturedPiecesDisplay();
    }
    
    updateCapturedPiecesDisplay() {
        const capturedWhiteEl = document.getElementById('captured-white-pieces');
        const capturedBlackEl = document.getElementById('captured-black-pieces');
        
        if (capturedWhiteEl) {
            const whiteSymbols = this.capturedPieces.white
                .map(piece => this.getPieceSymbol(piece.type, 'white'));
            capturedWhiteEl.innerHTML = whiteSymbols.join(' ');
        }
        
        if (capturedBlackEl) {
            const blackSymbols = this.capturedPieces.black
                .map(piece => this.getPieceSymbol(piece.type, 'black'));
            capturedBlackEl.innerHTML = blackSymbols.join(' ');
        }
    }
    
    getPieceSymbol(type, color) {
        const symbols = {
            white: {
                p: '♙', r: '♖', n: '♘', b: '♗', q: '♕', k: '♔'
            },
            black: {
                p: '♟', r: '♜', n: '♞', b: '♝', q: '♛', k: '♚'
            }
        };
        return symbols[color][type] || '';
    }
    
    setupKeyboardNavigation() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'r' || e.key === 'R') {
                this.rotateBoard();
            }
        });
    }
    
    // Sound System
    initializeSoundSystem() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (error) {
            console.warn('Web Audio API not supported, sounds disabled');
            this.soundEnabled = false;
        }
    }
    
    playSound(type) {
        if (!this.soundEnabled || !this.audioContext) return;
        
        try {
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            // Different sounds for different events
            switch (type) {
                case 'move':
                    oscillator.frequency.setValueAtTime(800, this.audioContext.currentTime);
                    oscillator.frequency.exponentialRampToValueAtTime(600, this.audioContext.currentTime + 0.1);
                    gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
                    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.1);
                    oscillator.start(this.audioContext.currentTime);
                    oscillator.stop(this.audioContext.currentTime + 0.1);
                    break;
                    
                case 'capture':
                    oscillator.frequency.setValueAtTime(1200, this.audioContext.currentTime);
                    oscillator.frequency.exponentialRampToValueAtTime(400, this.audioContext.currentTime + 0.2);
                    gainNode.gain.setValueAtTime(0.4, this.audioContext.currentTime);
                    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.2);
                    oscillator.start(this.audioContext.currentTime);
                    oscillator.stop(this.audioContext.currentTime + 0.2);
                    break;
                    
                case 'check':
                    // High-pitched warning sound
                    oscillator.frequency.setValueAtTime(1500, this.audioContext.currentTime);
                    oscillator.frequency.setValueAtTime(1200, this.audioContext.currentTime + 0.1);
                    oscillator.frequency.setValueAtTime(1500, this.audioContext.currentTime + 0.2);
                    gainNode.gain.setValueAtTime(0.4, this.audioContext.currentTime);
                    gainNode.gain.setValueAtTime(0.2, this.audioContext.currentTime + 0.1);
                    gainNode.gain.setValueAtTime(0.4, this.audioContext.currentTime + 0.2);
                    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.3);
                    oscillator.start(this.audioContext.currentTime);
                    oscillator.stop(this.audioContext.currentTime + 0.3);
                    break;
                    
                case 'checkmate':
                    // Victory/defeat fanfare
                    oscillator.frequency.setValueAtTime(523, this.audioContext.currentTime); // C5
                    oscillator.frequency.setValueAtTime(659, this.audioContext.currentTime + 0.2); // E5
                    oscillator.frequency.setValueAtTime(784, this.audioContext.currentTime + 0.4); // G5
                    oscillator.frequency.setValueAtTime(1047, this.audioContext.currentTime + 0.6); // C6
                    gainNode.gain.setValueAtTime(0.5, this.audioContext.currentTime);
                    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 1.0);
                    oscillator.start(this.audioContext.currentTime);
                    oscillator.stop(this.audioContext.currentTime + 1.0);
                    break;
                    
                case 'gameStart':
                    // Game start sound
                    oscillator.frequency.setValueAtTime(440, this.audioContext.currentTime); // A4
                    oscillator.frequency.setValueAtTime(523, this.audioContext.currentTime + 0.15); // C5
                    gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
                    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.3);
                    oscillator.start(this.audioContext.currentTime);
                    oscillator.stop(this.audioContext.currentTime + 0.3);
                    break;
                    
                default:
                    // Default click sound
                    oscillator.frequency.setValueAtTime(600, this.audioContext.currentTime);
                    gainNode.gain.setValueAtTime(0.2, this.audioContext.currentTime);
                    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.05);
                    oscillator.start(this.audioContext.currentTime);
                    oscillator.stop(this.audioContext.currentTime + 0.05);
            }
        } catch (error) {
            console.warn('Error playing sound:', error);
        }
    }
    
    toggleSound() {
        this.soundEnabled = !this.soundEnabled;
        this.updateSoundButtonState();
        
        // Play a test sound when enabling
        if (this.soundEnabled) {
            this.playSound('move');
        }
    }
    
    updateSoundButtonState() {
        const soundBtn = document.getElementById('sound-toggle-btn');
        if (soundBtn) {
            const icon = soundBtn.querySelector('.toggle-icon');
            if (icon) {
                icon.textContent = this.soundEnabled ? '🔊' : '🔇';
            }
            soundBtn.classList.toggle('active', this.soundEnabled);
        }
    }
    
    
    // Error message handling
    showErrorMessage(message) {
        const errorElement = document.querySelector('.error-message');
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.style.display = 'block';
            setTimeout(() => this.clearErrorMessage(), 3000);
        }
    }
    
    clearErrorMessage() {
        const errorElement = document.querySelector('.error-message');
        if (errorElement) {
            errorElement.style.display = 'none';
            errorElement.textContent = '';
        }
    }
    
    // Game ID display update
    updateGameIdDisplay() {
        const gameIdElement = document.querySelector('.game-id span');
        if (gameIdElement && this.gameId) {
            gameIdElement.textContent = this.gameId;
        }
    }
    
    attachEventListeners() {
        // Wait for DOM to be fully loaded
        if (document.readyState !== 'complete') {
            console.log('DOM not ready, waiting...');
            setTimeout(() => this.attachEventListeners(), 100);
            return;
        }
        
        try {
            const aiGameBtn = document.getElementById('ai-game-btn');
            if (!aiGameBtn) {
                console.error('AI game button not found in DOM');
                return;
            }
            
            aiGameBtn.addEventListener('click', () => {
                console.log('AI game button clicked');
                document.getElementById('ai-setup-modal').style.display = 'flex';
            });
            console.log('AI game button listener attached successfully');
        } catch (error) {
            console.error('Error attaching AI game button listener:', error);
        }
        
        const newGameBtn = document.getElementById('new-game-btn');
        if (newGameBtn) {
            newGameBtn.addEventListener('click', () => {
                console.log('New human game clicked');
                this.createGame('human');
            });
            console.log('New game button listener attached successfully');
        } else {
            console.error('New game button not found');
        }
        
        const rotateBtn = document.getElementById('rotate-board-btn');
        if (rotateBtn) {
            rotateBtn.addEventListener('click', () => {
                this.rotateBoard();
            });
            console.log('Rotate button listener attached successfully');
        } else {
            console.error('Rotate button not found');
        }
        
        const toggleBtn = document.getElementById('toggle-move-highlight-btn');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => {
                this.toggleMoveHighlighting();
            });
            console.log('Toggle move highlight button listener attached successfully');
        } else {
            console.error('Toggle move highlight button not found');
        }

        const soundToggleBtn = document.getElementById('sound-toggle-btn');
        if (soundToggleBtn) {
            soundToggleBtn.addEventListener('click', () => {
                this.toggleSound();
            });
            console.log('Sound toggle button listener attached successfully');
        } else {
            console.error('Sound toggle button not found');
        }
        
        const modal = document.getElementById('ai-setup-modal');
        const startAIGameBtn = document.getElementById('start-ai-game');
        const cancelAIBtn = document.getElementById('cancel-ai-setup');
        
        if (!modal) {
            console.error('AI setup modal not found');
            return;
        }
        
        if (!startAIGameBtn) {
            console.error('Start AI game button not found');
            return;
        } else {
            console.log('Start AI game button found:', startAIGameBtn);
        }
        
        if (!cancelAIBtn) {
            console.error('Cancel AI button not found');
            return;
        }
        
        startAIGameBtn.addEventListener('click', (event) => {
            console.log('Start AI game clicked - event triggered');
            event.preventDefault();
            const colorSelect = document.getElementById('ai-color');
        const difficultySlider = document.getElementById('ai-difficulty');
            
            if (!colorSelect || !difficultySlider) {
                console.error('Missing form elements:', { colorSelect, difficultySlider });
                return;
            }
            
            const aiSettings = {
                color: colorSelect.value,
                difficulty: parseInt(difficultySlider.value)
            };
            
            console.log('Creating AI game with settings:', aiSettings);
            try {
                const gameCreated = this.createGame('ai', aiSettings);
                console.log('Game creation result:', gameCreated);
            modal.style.display = 'none';
            } catch (error) {
                console.error('Error creating AI game:', error);
                this.showErrorMessage('Failed to start AI game. Please try again.');
            }
        });
        
        cancelAIBtn.addEventListener('click', () => {
            console.log('Cancel AI game clicked');
            modal.style.display = 'none';
        });
        
        // Add close button (X) functionality
        const closeBtn = modal.querySelector('.close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                console.log('Close X button clicked');
                modal.style.display = 'none';
            });
        }
        
        window.addEventListener('click', (event) => {
            if (event.target === modal) {
                console.log('Modal backdrop clicked');
                modal.style.display = 'none';
            }
        });
        
        const difficultySlider = document.getElementById('ai-difficulty');
        const difficultyValue = document.getElementById('difficulty-value');
        
        difficultySlider.addEventListener('input', () => {
            difficultyValue.textContent = difficultySlider.value;
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.chessGame = new ChessGameClient();
});

// Fallback if DOMContentLoaded already fired
if (document.readyState !== 'loading') {
    window.chessGame = new ChessGameClient();
}
