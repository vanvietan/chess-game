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
        
        // P2P/Multiplayer state
        this.isMultiplayer = false;
        this.peerID = null;
        this.isHost = false;
        this.connectedPeers = [];
        
        // WebSocket connection
        this.ws = null;
        this.wsConnected = false;
        
        // UI state
        this.boardRotated = false;
        this.moveHistory = [];
        this.capturedPieces = { white: [], black: [] };
        this.showMoveHighlighting = true;
        this.soundEnabled = true;
        this.showLegalMovesOnHover = true;
        
        // Input method selection: 'drag', 'click'
        this.inputMethod = 'drag';
        this.selectedSquare = null;
        this.mutationObserver = null;
        this.lastDragTime = 0;
        
        
        // Initialize
        this.initializeChessboard();
        this.attachEventListeners();
        this.updateUI();
        this.updateInputMethodButton();
        this.updateToggleButtonState();
        this.updateSoundButtonState();
        this.setupKeyboardNavigation();
        this.initializeSoundSystem();
        this.initializeWebSocket();
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

        this.applyResponsiveBoardSize();

        try {
            this.chessboard = Chessboard('chessboard', {
                draggable: true,
                position: 'start',
                onDragStart: this.onDragStart.bind(this),
                onDrop: this.onDrop.bind(this),
                onSnapEnd: this.onSnapEnd.bind(this),
                onMouseoverSquare: this.onMouseoverSquare.bind(this),
                onMouseoutSquare: this.onMouseoutSquare.bind(this),
                onSquareClick: this.onSquareClick.bind(this),
                pieceTheme: 'https://chessboardjs.com/img/chesspieces/wikipedia/{piece}.png',
                showNotation: true,
                sparePieces: false
            });
            
            console.log('Chessboard initialized with click-to-move');
            
            // Override chessboard.js click handling
            setTimeout(() => this.overrideChessboardClicks(), 1000);
            setTimeout(() => this.resizeChessboard(), 0);
            window.addEventListener('resize', () => this.resizeChessboard());
            
        } catch (error) {
            setTimeout(() => this.initializeChessboard(), 500);
            return;
        }
        
        this.updateUI();
        }

    resizeChessboard() {
        this.applyResponsiveBoardSize();

        if (!this.chessboard || typeof this.chessboard.resize !== 'function') {
            return;
        }

        this.chessboard.resize();
        this.chessboard.position(this.game.fen(), false);
    }

    applyResponsiveBoardSize() {
        const boardShell = document.querySelector('.board-container-inner');
        const boardElement = document.getElementById('chessboard');
        if (!boardShell || !boardElement) return;

        const viewportWidth = Math.min(
            window.innerWidth || 520,
            window.outerWidth || window.innerWidth || 520,
            window.screen ? window.screen.width : 520
        );
        const parentWidth = boardShell.parentElement ? boardShell.parentElement.clientWidth : viewportWidth;
        const availableWidth = Math.min(parentWidth - 24, viewportWidth - 76);
        const shellSize = Math.max(240, Math.min(520, availableWidth));

        boardShell.style.width = shellSize + 'px';
        boardShell.style.height = 'auto';
        boardElement.style.width = shellSize + 'px';
        boardElement.style.height = shellSize + 'px';

        requestAnimationFrame(() => {
            const renderedBoard = boardElement.firstElementChild;
            if (renderedBoard) {
                boardShell.style.height = renderedBoard.getBoundingClientRect().height + 'px';
            }
        });
    }
        
    onDragStart(source, piece, position, orientation) {
        // Check if drag is allowed in current input method
        if (this.inputMethod === 'click') {
            return false; // Disable drag in click-only mode
        }
        
        const currentPlayer = this.game.turn() === 'w' ? 'white' : 'black';
        const pieceColor = piece.charAt(0) === 'w' ? 'white' : 'black';

        if (pieceColor !== currentPlayer || this.game.game_over() || this.aiThinking) {
            return false;
        }
        
        // Record drag start time to prevent clicks immediately after drag
        this.lastDragTime = Date.now();
        
        // Clear any selection when starting to drag
        if (this.selectedSquare) {
            this.clearSquareSelection();
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
        // Update drag time when drag completes
        this.lastDragTime = Date.now();
    }
    
    // No hover highlighting - only highlights when clicking
    onMouseoverSquare(square, piece) {
        // No hover highlighting anymore
    }
    
    onMouseoutSquare() {
        // No hover highlighting anymore
    }
    
    highlightSquares(sourceSquare, moves) {
        // Clear any existing highlights first
        this.removeHighlights();
        
        // Highlight source square with selected style
        this.addHighlight(sourceSquare, 'selected-square');
        
        // Highlight destination squares
        for (let move of moves) {
            this.addHighlight(move.to, 'highlight-black');
        }
    }
    
    addHighlight(square, className) {
        const squareEl = document.querySelector('#chessboard .square-' + square);
        if (squareEl) {
            squareEl.classList.add(className);
        }
    }
    
    removeHighlights() {
        document.querySelectorAll('#chessboard .square-55d63').forEach(square => {
            square.classList.remove('highlight-white', 'highlight-black', 'selected-square');
        });
    }
    
    // Override chessboard.js internal click handling
    overrideChessboardClicks() {
        console.log('🔧 Overriding chessboard.js click handling...');
        
        const chessboardEl = document.getElementById('chessboard');
        if (!chessboardEl) {
            console.error('Chessboard element not found');
            return;
        }
        
        // Find all squares and pieces
        const squares = chessboardEl.querySelectorAll('.square-55d63');
        const pieces = chessboardEl.querySelectorAll('.piece-417db');
        
        console.log(`Found ${squares.length} squares and ${pieces.length} pieces`);
        
        // Override clicks on squares
        squares.forEach(square => {
            const classes = square.className;
            const match = classes.match(/square-([a-h][1-8])/);
            
            if (match) {
                const squareName = match[1];
                
                // Remove all existing event listeners by cloning the element
                const newSquare = square.cloneNode(true);
                square.parentNode.replaceChild(newSquare, square);
                
                // Add our click handler
                newSquare.addEventListener('click', (e) => {
                    // Only allow clicks in click mode
                    if (this.inputMethod !== 'click') {
                        return;
                    }
                    
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    this.onSquareClick(squareName);
                }, true);
            }
        });
        
        // Override clicks on pieces
        pieces.forEach(piece => {
            const square = piece.closest('.square-55d63');
            if (square) {
                const classes = square.className;
                const match = classes.match(/square-([a-h][1-8])/);
                
                if (match) {
                    const squareName = match[1];
                    
                    // Remove all existing event listeners by cloning the element
                    const newPiece = piece.cloneNode(true);
                    piece.parentNode.replaceChild(newPiece, piece);
                    
                    // Add our click handler
                    newPiece.addEventListener('click', (e) => {
                        // Only allow clicks in click mode
                        if (this.inputMethod !== 'click') {
                            return;
                        }
                        
                        e.preventDefault();
                        e.stopImmediatePropagation();
                        this.onSquareClick(squareName);
                    }, true);
                }
            }
        });
        
        
        // Set up a mutation observer to handle dynamically added pieces
        this.setupMutationObserver();
    }
    
    // Watch for dynamically added pieces and override their clicks too
    setupMutationObserver() {
        if (this.mutationObserver) {
            this.mutationObserver.disconnect();
        }
        
        const chessboardEl = document.getElementById('chessboard');
        if (!chessboardEl) return;
        
        this.mutationObserver = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        // Check if it's a piece
                        if (node.classList && node.classList.contains('piece-417db')) {
                            this.overridePieceClick(node);
                        }
                        
                        // Check for pieces in added subtrees
                        const pieces = node.querySelectorAll && node.querySelectorAll('.piece-417db');
                        if (pieces) {
                            pieces.forEach(piece => this.overridePieceClick(piece));
                        }
                    }
                });
            });
        });
        
        this.mutationObserver.observe(chessboardEl, {
            childList: true,
            subtree: true
        });
        
    }
    
    // Override clicks on a single piece
    overridePieceClick(piece) {
        const square = piece.closest('.square-55d63');
        if (square) {
            const classes = square.className;
            const match = classes.match(/square-([a-h][1-8])/);
            
            if (match) {
                const squareName = match[1];
                
                piece.addEventListener('click', (e) => {
                    // Only allow clicks in click mode
                    if (this.inputMethod !== 'click') {
                        return;
                    }
                    
                    e.preventDefault();
                    e.stopImmediatePropagation();
                    this.onSquareClick(squareName);
                }, true);
            }
        }
    }
    
    // Simple click-to-move implementation
    onSquareClick(square) {
        // If no piece is selected, try to select this square
        if (!this.selectedSquare) {
            this.selectPiece(square);
        } else {
            // A piece is selected, try to move to clicked square
            this.tryMove(this.selectedSquare, square);
        }
    }
    
    selectPiece(square) {
        const piece = this.game.get(square);
        
        // Only select if there's a piece and it belongs to current player
        if (!piece) {
            return;
        }
        
        const currentPlayer = this.game.turn();
        if (piece.color !== currentPlayer) {
            return;
        }
        
        // If clicking the same square, deselect
        if (this.selectedSquare === square) {
            this.clearSquareSelection();
            return;
        }
        
        this.selectedSquare = square;
        
        // Get legal moves for this piece and highlight them
        const moves = this.game.moves({
            square: square,
            verbose: true
        });
        
        // Highlight the selected square and its legal moves
        this.highlightSquares(square, moves);
    }
    
    tryMove(fromSquare, toSquare) {
        // Try the move with chess.js
        const move = this.game.move({
            from: fromSquare,
            to: toSquare,
            promotion: 'q' // Always promote to queen
        });
        
        if (move) {
            // Legal move - update the board position
            this.chessboard.position(this.game.fen());
            this.clearSquareSelection();
            this.updateAfterMove(move);
        } else {
            // Illegal move - try to select the destination square instead
            this.clearSquareSelection();
            this.selectPiece(toSquare);
        }
    }
    
    clearSquareSelection() {
        this.selectedSquare = null;
        this.removeHighlights();
    }
    
    // Toggle between input methods: drag ↔ click
    toggleInputMethod() {
        this.inputMethod = this.inputMethod === 'drag' ? 'click' : 'drag';
        
        // Clear any selection when switching methods
        this.clearSquareSelection();
        
        this.updateInputMethodButton();
    }
    
    updateInputMethodButton() {
        const button = document.getElementById('input-method-btn');
        const text = document.getElementById('input-method-text');
        
        if (button && text) {
            const icons = {
                'drag': 'Mouse',
                'click': 'Tap'
            };
            
            const names = {
                'drag': 'Drag',
                'click': 'Click'
            };
            
            button.querySelector('.toggle-icon').textContent = icons[this.inputMethod];
            text.textContent = names[this.inputMethod];
            
            const titles = {
                'drag': 'Drag-and-drop pieces to move',
                'click': 'Click pieces to move'
            };
            
            button.title = titles[this.inputMethod];
        }
    }
    
    
    updateAfterMove(move) {
        this.addMoveToHistory(move);
        
        // Clear any selection after move
        if (this.selectedSquare) {
            this.clearSquareSelection();
        }
        
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
        
        // Send move to backend if in multiplayer mode
        if (this.isMultiplayer && this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.sendWebSocketMessage('make_move', {
                from: move.from,
                to: move.to,
                piece: move.piece,
                captured: move.captured,
                promotion: move.promotion,
                san: move.san,
                fen: this.game.fen(),
                is_check: this.game.in_check(),
                is_checkmate: this.game.in_checkmate()
            });
        }
        
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
        const currentPlayerEl = document.getElementById('current-player');
        if (currentPlayerEl) {
            const currentPlayer = this.game.turn() === 'w' ? 'White' : 'Black';
            currentPlayerEl.textContent = currentPlayer;
        }
        
        const gameStatusEl = document.getElementById('game-status');
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
        
        const gameModeEl = document.getElementById('game-mode');
        if (gameModeEl) {
            const mode = this.gameMode === 'ai' ? 'Human vs AI (' + this.aiColor + ')' : 'Human vs Human';
            gameModeEl.textContent = mode;
        }
        
        const aiInfoContainer = document.getElementById('ai-info');
        const aiInfoEl = document.getElementById('ai-difficulty-display');
        if (aiInfoEl) {
            const depthLevel = Math.min(Math.max(this.aiDifficulty, 1), 18);
            const strengthDesc = this.getAILevelDescription(this.aiDifficulty);
            
            aiInfoEl.textContent = `Depth ${depthLevel} · ${strengthDesc}`;
        }

        if (aiInfoContainer) {
            aiInfoContainer.style.display = this.gameMode === 'ai' ? 'grid' : 'none';
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
                icon.textContent = this.soundEnabled ? 'On' : 'Off';
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
            
        // P2P Multiplayer button
        const p2pGameBtn = document.getElementById('p2p-game-btn');
        if (p2pGameBtn) {
            p2pGameBtn.addEventListener('click', () => {
                console.log('P2P Multiplayer button clicked');
                this.createMultiplayerGame('Player');
            });
            console.log('P2P game button listener attached successfully');
        } else {
            console.error('P2P game button not found');
        }
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
        
        const inputMethodBtn = document.getElementById('input-method-btn');
        if (inputMethodBtn) {
            inputMethodBtn.addEventListener('click', () => {
                this.toggleInputMethod();
            });
            console.log('Input method button listener attached successfully');
        } else {
            console.error('Input method button not found');
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
    
    // WebSocket Integration for P2P Multiplayer
    initializeWebSocket() {
        const wsUrl = `ws://${window.location.host}/ws`;
        console.log('🔌 Connecting to WebSocket:', wsUrl);
        
        try {
            this.ws = new WebSocket(wsUrl);
            
            this.ws.onopen = (event) => {
                console.log('✅ WebSocket connected');
                this.wsConnected = true;
                this.updateConnectionStatus();
            };
            
            this.ws.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    this.handleWebSocketMessage(message);
                } catch (error) {
                    console.error('Failed to parse WebSocket message:', error);
                }
            };
            
            this.ws.onclose = (event) => {
                console.log('🔌 WebSocket disconnected');
                this.wsConnected = false;
                this.updateConnectionStatus();
                
                // Attempt to reconnect after 3 seconds
                setTimeout(() => {
                    if (!this.wsConnected) {
                        console.log('🔄 Attempting to reconnect...');
                        this.initializeWebSocket();
                    }
                }, 3000);
            };
            
            this.ws.onerror = (error) => {
                console.error('❌ WebSocket error:', error);
                this.wsConnected = false;
                this.updateConnectionStatus();
            };
            
        } catch (error) {
            console.error('Failed to initialize WebSocket:', error);
        }
    }
    
    handleWebSocketMessage(message) {
        console.log('📨 Received:', message.type, message.data);
        
        switch (message.type) {
            case 'connected':
                this.peerID = message.data.peer_id;
                console.log('🆔 Our Peer ID:', this.peerID);
                break;
                
            case 'game_created':
                this.handleGameCreated(message.data);
                break;
                
            case 'game_invite':
                this.handleGameInvite(message.data);
                break;
                
            case 'game_start':
                this.handleGameStart(message.data);
                break;
                
            case 'move':
                this.handleOpponentMove(message.data);
                break;
                
            case 'game_state':
                this.handleGameState(message.data);
                break;
                
            case 'error':
                this.handleError(message.data);
                break;
                
            default:
                console.log('Unknown message type:', message.type);
        }
    }
    
    sendWebSocketMessage(type, data = {}) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.error('WebSocket not connected');
            return false;
        }
        
        const message = { type, data };
        this.ws.send(JSON.stringify(message));
        console.log('📤 Sent:', type, data);
        return true;
    }
    
    updateConnectionStatus() {
        const statusElement = document.getElementById('game-status');
        if (statusElement) {
            if (this.wsConnected) {
                statusElement.style.color = '#4CAF50';
                if (this.gameStatus === 'waiting') {
                    statusElement.textContent = 'Connected - Ready to Play';
                }
            } else {
                statusElement.style.color = '#f44336';
                statusElement.textContent = 'Disconnected';
            }
        }
    }
    
    // P2P Game Methods
    createMultiplayerGame(playerName = 'Player') {
        this.isMultiplayer = true;
        this.isHost = true;
        this.gameMode = 'multiplayer';
        
        return this.sendWebSocketMessage('create_game', {
            player_name: playerName
        });
    }
    
    handleGameCreated(data) {
        this.gameId = data.game.id;
        this.gameStatus = 'waiting';
        console.log('🎮 Multiplayer game created:', this.gameId);
        this.updateUI();
        
        // Show peer ID for sharing
        this.showPeerInfo();
    }
    
    showPeerInfo() {
        const info = `
            <div>
                <h3>Multiplayer Game Created</h3>
                <p><strong>Game ID:</strong> ${this.gameId}</p>
                <p><strong>Your Peer ID:</strong> ${this.peerID}</p>
                <p>Share this Peer ID with your opponent to join the game.</p>
            </div>
        `;
        
        // Add to the page
        const gameContainer = document.querySelector('.game-container');
        if (gameContainer) {
            const existingInfo = gameContainer.querySelector('.peer-info');
            if (existingInfo) {
                existingInfo.remove();
            }
            
            const infoDiv = document.createElement('div');
            infoDiv.className = 'peer-info';
            infoDiv.innerHTML = info;
            gameContainer.insertBefore(infoDiv, gameContainer.children[1]);
        }
    }
    
    handleOpponentMove(data) {
        const move = data.move;
        const game = data.game;
        
        // Apply the move to our board
        const chessMove = this.game.move({
            from: move.from,
            to: move.to,
            promotion: move.promotion
        });
        
        if (chessMove) {
            this.chessboard.position(this.game.fen());
            this.updateAfterMove(chessMove);
            console.log('♟️ Opponent move applied:', move.san);
        } else {
            console.error('Failed to apply opponent move:', move);
        }
    }
    
    handleGameState(data) {
        const game = data.game;
        // Sync game state
        this.game.load(game.board_fen);
        this.chessboard.position(this.game.fen());
        this.updateUI();
    }
    
    handleError(data) {
        console.error('Game error:', data);
        alert('Game Error: ' + (data.message || 'Unknown error'));
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.chessGame = new ChessGameClient();
    
    // Expose test functions globally
    window.testClick = (square) => {
        console.log('Testing click on', square);
        window.chessGame.onSquareClick(square);
    };
    
    window.recheckClickListeners = () => {
        console.log('Re-adding click listeners...');
        window.chessGame.addManualClickListeners();
    };
});

// Fallback if DOMContentLoaded already fired
if (document.readyState !== 'loading') {
    window.chessGame = new ChessGameClient();
    
    // Expose test functions globally
    window.testClick = (square) => {
        console.log('Testing click on', square);
        window.chessGame.onSquareClick(square);
    };
    
    window.recheckClickListeners = () => {
        console.log('Re-adding click listeners...');
        window.chessGame.addManualClickListeners();
    };
}
