class ChessGameClient {
    constructor() {
        this.gameId = null;
        this.board = [];
        this.currentPlayer = 'white';
        this.selectedSquare = null;
        this.gameStatus = 'playing';
        this.gameMode = 'pvp';
        this.aiColor = '';
        this.aiDifficulty = 8;
        this.aiThinking = false;
        this.ws = null;
        
        // Chess piece Unicode symbols
        this.pieceSymbols = {
            white: {
                king: '♔', queen: '♕', rook: '♖',
                bishop: '♗', knight: '♘', pawn: '♙'
            },
            black: {
                king: '♚', queen: '♛', rook: '♜',
                bishop: '♝', knight: '♞', pawn: '♟'
            }
        };
        
        this.initializeBoard();
        this.renderBoard();
        this.attachEventListeners();
        this.initializeWebSocket();
    }
    
    initializeBoard() {
        // Initialize empty 8x8 board
        this.board = Array(8).fill(null).map(() => Array(8).fill(null));
        
        // Set up initial chess position
        const initialSetup = [
            ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook'],
            ['pawn', 'pawn', 'pawn', 'pawn', 'pawn', 'pawn', 'pawn', 'pawn']
        ];
        
        // Place black pieces
        for (let col = 0; col < 8; col++) {
            this.board[0][col] = { type: initialSetup[0][col], color: 'black' };
            this.board[1][col] = { type: initialSetup[1][col], color: 'black' };
        }
        
        // Place white pieces
        for (let col = 0; col < 8; col++) {
            this.board[7][col] = { type: initialSetup[0][col], color: 'white' };
            this.board[6][col] = { type: initialSetup[1][col], color: 'white' };
        }
    }
    
    initializeWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/api/ws`;
        
        this.ws = new WebSocket(wsUrl);
        
        this.ws.onopen = () => {
            console.log('WebSocket connected');
        };
        
        this.ws.onmessage = (event) => {
            const message = JSON.parse(event.data);
            this.handleWebSocketMessage(message);
        };
        
        this.ws.onclose = () => {
            console.log('WebSocket disconnected');
            // Try to reconnect after 3 seconds
            setTimeout(() => this.initializeWebSocket(), 3000);
        };
        
        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
        };
    }
    
    handleWebSocketMessage(message) {
        switch (message.type) {
            case 'game_update':
                this.handleGameUpdate(message.data);
                break;
            case 'joined_game':
                console.log('Joined game:', message.gameId);
                break;
            case 'pong':
                // Handle ping-pong for connection keep-alive
                break;
        }
    }
    
    handleGameUpdate(update) {
        if (update.gameId === this.gameId) {
            // Update game state based on server update
            this.updateBoardFromFEN(update.fen);
            this.currentPlayer = update.currentTurn;
            this.gameStatus = update.gameStatus;
            this.updateUI();
        }
    }
    
    sendWebSocketMessage(message) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        }
    }
    
    async createGame(mode, aiSettings = null) {
        try {
            const response = await fetch('/api/games', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    mode: mode,
                    playerName: 'Player 1',
                    aiSettings: aiSettings
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.gameId = data.gameId;
                this.gameMode = mode;
                if (aiSettings) {
                    this.aiColor = aiSettings.color;
                    this.aiDifficulty = aiSettings.difficulty;
                }
                
                // Join the game via WebSocket
                this.sendWebSocketMessage({
                    type: 'join_game',
                    gameId: this.gameId
                });
                
                this.updateUI();
                
                // If AI plays white, get AI move
                if (mode === 'ai' && aiSettings.color === 'white') {
                    this.requestAIMove();
                }
                
                return true;
            } else {
                console.error('Failed to create game:', data.error);
                return false;
            }
        } catch (error) {
            console.error('Error creating game:', error);
            return false;
        }
    }
    
    async makeMove(from, to, promotion = null) {
        if (!this.gameId) {
            console.error('No active game');
            this.showErrorMessage('No active game');
            return false;
        }
        
        // Add visual feedback that move is being processed
        this.showMoveProcessing(true);
        
        try {
            const response = await fetch(`/api/games/${this.gameId}/moves`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    from: from,
                    to: to,
                    promotion: promotion
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                // Clear selection immediately on successful move
                this.clearSelection();
                
                // Update board from server response
                this.updateBoardFromFEN(data.fen);
                this.currentPlayer = data.currentTurn;
                this.gameStatus = data.gameStatus;
                this.updateUI();
                
                // Clear any error messages
                this.clearErrorMessage();
                
                // Check if AI should move next
                if (this.gameMode === 'ai' && 
                    this.currentPlayer === this.aiColor && 
                    this.gameStatus === 'playing') {
                    this.requestAIMove();
                }
                
                return true;
            } else {
                console.error('Invalid move:', data.error);
                this.showErrorMessage(`Invalid move: ${this.extractMoveError(data.error)}`);
                return false;
            }
        } catch (error) {
            console.error('Error making move:', error);
            this.showErrorMessage('Network error occurred');
            return false;
        } finally {
            // Always hide move processing indicator
            this.showMoveProcessing(false);
        }
    }
    
    extractMoveError(errorMessage) {
        // Extract a user-friendly error from the technical error message
        if (errorMessage.includes('could not decode algebraic notation')) {
            return 'That move is not legal in the current position';
        }
        if (errorMessage.includes('Game not found')) {
            return 'Game session has expired';
        }
        return 'Move not allowed';
    }
    
    showErrorMessage(message) {
        // Remove any existing error message
        this.clearErrorMessage();
        
        // Create and show error message
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = message;
        errorDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background-color: #ff6b6b;
            color: white;
            padding: 12px 20px;
            border-radius: 6px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 1000;
            font-weight: bold;
            animation: slideIn 0.3s ease-out;
        `;
        
        document.body.appendChild(errorDiv);
        
        // Auto-remove after 3 seconds
        setTimeout(() => {
            this.clearErrorMessage();
        }, 3000);
    }
    
    clearErrorMessage() {
        const existing = document.querySelector('.error-message');
        if (existing) {
            existing.remove();
        }
    }
    
    async requestAIMove() {
        if (!this.gameId || this.aiThinking) {
            return;
        }
        
        this.aiThinking = true;
        this.showAIThinking(true);
        
        try {
            const response = await fetch(`/api/games/${this.gameId}/ai-move`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    fen: this.getFEN()
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                // Make the AI move
                await this.makeMove(data.from, data.to, data.promotion);
            } else {
                console.error('AI move failed:', data.error);
            }
        } catch (error) {
            console.error('Error getting AI move:', error);
        } finally {
            this.aiThinking = false;
            this.showAIThinking(false);
        }
    }
    
    updateBoardFromFEN(fen) {
        // Simple FEN parsing - in a real implementation, you'd use a proper chess library
        const parts = fen.split(' ');
        const boardPart = parts[0];
        const rows = boardPart.split('/');
        
        this.board = Array(8).fill(null).map(() => Array(8).fill(null));
        
        for (let row = 0; row < 8; row++) {
            let col = 0;
            for (let char of rows[row]) {
                if (char >= '1' && char <= '8') {
                    col += parseInt(char);
                } else {
                    const color = char === char.toUpperCase() ? 'white' : 'black';
                    const type = this.getTypeFromFENChar(char.toLowerCase());
                    this.board[row][col] = { type, color };
                    col++;
                }
            }
        }
        
        this.renderBoard();
    }
    
    getTypeFromFENChar(char) {
        const map = {
            'p': 'pawn',
            'r': 'rook',
            'n': 'knight',
            'b': 'bishop',
            'q': 'queen',
            'k': 'king'
        };
        return map[char] || 'pawn';
    }
    
    getFEN() {
        // Simple FEN generation - in a real implementation, you'd use a proper chess library
        let fen = '';
        
        for (let row = 0; row < 8; row++) {
            let emptyCount = 0;
            let rowString = '';
            
            for (let col = 0; col < 8; col++) {
                const piece = this.board[row][col];
                if (piece) {
                    if (emptyCount > 0) {
                        rowString += emptyCount;
                        emptyCount = 0;
                    }
                    const char = this.getFENChar(piece.type);
                    rowString += piece.color === 'white' ? char.toUpperCase() : char.toLowerCase();
                } else {
                    emptyCount++;
                }
            }
            
            if (emptyCount > 0) {
                rowString += emptyCount;
            }
            
            fen += rowString;
            if (row < 7) fen += '/';
        }
        
        // Add other FEN parts (simplified)
        fen += ` ${this.currentPlayer.charAt(0)} - - 0 1`;
        
        return fen;
    }
    
    getFENChar(type) {
        const map = {
            'pawn': 'p',
            'rook': 'r',
            'knight': 'n',
            'bishop': 'b',
            'queen': 'q',
            'king': 'k'
        };
        return map[type] || 'p';
    }
    
    renderBoard() {
        const boardElement = document.getElementById('chess-board');
        boardElement.innerHTML = '';
        
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const square = document.createElement('div');
                square.className = `square ${(row + col) % 2 === 0 ? 'light' : 'dark'}`;
                square.dataset.row = row;
                square.dataset.col = col;
                
                const piece = this.board[row][col];
                if (piece) {
                    const pieceElement = document.createElement('span');
                    pieceElement.className = `piece piece-${piece.color} piece-${piece.type}`;
                    pieceElement.textContent = this.pieceSymbols[piece.color][piece.type];
                    square.appendChild(pieceElement);
                }
                
                square.addEventListener('click', (e) => this.handleSquareClick(e));
                boardElement.appendChild(square);
            }
        }
        
        // Update UI hints after rendering
        setTimeout(() => this.updateBoardHints(), 100);
    }
    
    handleSquareClick(event) {
        if (this.gameStatus !== 'playing' || this.aiThinking) {
            return;
        }
        
        const square = event.currentTarget;
        const row = parseInt(square.dataset.row);
        const col = parseInt(square.dataset.col);
        const piece = this.board[row][col];
        
        if (this.selectedSquare) {
            // Trying to make a move
            const fromSquare = this.selectedSquare;
            const toSquare = this.getSquareNotation(row, col);
            const fromNotation = this.getSquareNotation(fromSquare.row, fromSquare.col);
            
            if (fromNotation !== toSquare) {
                // Attempt the move - selection will be cleared in makeMove
                this.makeMove(fromNotation, toSquare);
            } else {
                // Clicking on the same square - just clear selection
                this.clearSelection();
            }
        } else if (piece && piece.color === this.currentPlayer) {
            // Selecting a piece
            if (this.gameMode === 'ai' && this.currentPlayer === this.aiColor) {
                return; // Don't allow human to move AI pieces
            }
            
            this.selectedSquare = { row, col };
            this.highlightSquare(square);
        }
    }
    
    getSquareNotation(row, col) {
        const files = 'abcdefgh';
        const ranks = '87654321';
        return files[col] + ranks[row];
    }
    
    highlightSquare(square) {
        this.clearHighlights();
        square.classList.add('selected');
        
        // Highlight valid moves for the selected piece
        if (this.selectedSquare) {
            this.highlightValidMoves(this.selectedSquare.row, this.selectedSquare.col);
        }
    }
    
    highlightValidMoves(fromRow, fromCol) {
        const piece = this.board[fromRow][fromCol];
        if (!piece) return;
        
        // Get all possible moves for the piece type
        const validMoves = this.getValidMovesForPiece(piece, fromRow, fromCol);
        
        // Highlight each valid move square
        validMoves.forEach(({row, col}) => {
            const square = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
            if (square) {
                square.classList.add('valid-move');
            }
        });
    }
    
    getValidMovesForPiece(piece, fromRow, fromCol) {
        const moves = [];
        const {type, color} = piece;
        
        switch (type) {
            case 'knight':
                return this.getKnightMoves(fromRow, fromCol, color);
            case 'rook':
                return this.getRookMoves(fromRow, fromCol, color);
            case 'bishop':
                return this.getBishopMoves(fromRow, fromCol, color);
            case 'queen':
                return this.getQueenMoves(fromRow, fromCol, color);
            case 'king':
                return this.getKingMoves(fromRow, fromCol, color);
            case 'pawn':
                return this.getPawnMoves(fromRow, fromCol, color);
            default:
                return [];
        }
    }
    
    getKnightMoves(fromRow, fromCol, color) {
        const moves = [];
        const knightMoves = [
            [-2, -1], [-2, 1], [-1, -2], [-1, 2],
            [1, -2], [1, 2], [2, -1], [2, 1]
        ];
        
        knightMoves.forEach(([dRow, dCol]) => {
            const newRow = fromRow + dRow;
            const newCol = fromCol + dCol;
            
            if (this.isValidSquare(newRow, newCol)) {
                const targetPiece = this.board[newRow][newCol];
                // Can move to empty square or capture opponent piece
                if (!targetPiece || targetPiece.color !== color) {
                    moves.push({row: newRow, col: newCol});
                }
            }
        });
        
        return moves;
    }
    
    getPawnMoves(fromRow, fromCol, color) {
        const moves = [];
        const direction = color === 'white' ? -1 : 1;
        const startRow = color === 'white' ? 6 : 1;
        
        // Forward move
        const newRow = fromRow + direction;
        if (this.isValidSquare(newRow, fromCol) && !this.board[newRow][fromCol]) {
            moves.push({row: newRow, col: fromCol});
            
            // Two squares forward from starting position
            if (fromRow === startRow && !this.board[newRow + direction][fromCol]) {
                moves.push({row: newRow + direction, col: fromCol});
            }
        }
        
        // Captures
        [-1, 1].forEach(dCol => {
            const captureCol = fromCol + dCol;
            if (this.isValidSquare(newRow, captureCol)) {
                const targetPiece = this.board[newRow][captureCol];
                if (targetPiece && targetPiece.color !== color) {
                    moves.push({row: newRow, col: captureCol});
                }
            }
        });
        
        return moves;
    }
    
    getRookMoves(fromRow, fromCol, color) {
        const moves = [];
        const directions = [[0, 1], [0, -1], [1, 0], [-1, 0]];
        
        directions.forEach(([dRow, dCol]) => {
            for (let i = 1; i < 8; i++) {
                const newRow = fromRow + dRow * i;
                const newCol = fromCol + dCol * i;
                
                if (!this.isValidSquare(newRow, newCol)) break;
                
                const targetPiece = this.board[newRow][newCol];
                if (!targetPiece) {
                    moves.push({row: newRow, col: newCol});
                } else {
                    if (targetPiece.color !== color) {
                        moves.push({row: newRow, col: newCol});
                    }
                    break;
                }
            }
        });
        
        return moves;
    }
    
    getBishopMoves(fromRow, fromCol, color) {
        const moves = [];
        const directions = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
        
        directions.forEach(([dRow, dCol]) => {
            for (let i = 1; i < 8; i++) {
                const newRow = fromRow + dRow * i;
                const newCol = fromCol + dCol * i;
                
                if (!this.isValidSquare(newRow, newCol)) break;
                
                const targetPiece = this.board[newRow][newCol];
                if (!targetPiece) {
                    moves.push({row: newRow, col: newCol});
                } else {
                    if (targetPiece.color !== color) {
                        moves.push({row: newRow, col: newCol});
                    }
                    break;
                }
            }
        });
        
        return moves;
    }
    
    getQueenMoves(fromRow, fromCol, color) {
        return [
            ...this.getRookMoves(fromRow, fromCol, color),
            ...this.getBishopMoves(fromRow, fromCol, color)
        ];
    }
    
    getKingMoves(fromRow, fromCol, color) {
        const moves = [];
        const directions = [
            [-1, -1], [-1, 0], [-1, 1],
            [0, -1],           [0, 1],
            [1, -1],  [1, 0],  [1, 1]
        ];
        
        directions.forEach(([dRow, dCol]) => {
            const newRow = fromRow + dRow;
            const newCol = fromCol + dCol;
            
            if (this.isValidSquare(newRow, newCol)) {
                const targetPiece = this.board[newRow][newCol];
                if (!targetPiece || targetPiece.color !== color) {
                    moves.push({row: newRow, col: newCol});
                }
            }
        });
        
        return moves;
    }
    
    isValidSquare(row, col) {
        return row >= 0 && row < 8 && col >= 0 && col < 8;
    }
    
    clearHighlights() {
        document.querySelectorAll('.square').forEach(sq => {
            sq.classList.remove('selected', 'valid-move');
        });
    }
    
    clearSelection() {
        this.selectedSquare = null;
        this.clearHighlights();
    }
    
    updateUI() {
        const currentPlayerElement = document.getElementById('current-player');
        currentPlayerElement.textContent = 
            this.currentPlayer.charAt(0).toUpperCase() + this.currentPlayer.slice(1);
        
        // Add visual indicator for current player
        currentPlayerElement.style.color = this.currentPlayer === 'white' ? '#fff' : '#333';
        currentPlayerElement.style.backgroundColor = this.currentPlayer === 'white' ? '#333' : '#fff';
        currentPlayerElement.style.padding = '4px 8px';
        currentPlayerElement.style.borderRadius = '4px';
        currentPlayerElement.style.fontWeight = 'bold';
        
        document.getElementById('game-status').textContent = 
            this.gameStatus.charAt(0).toUpperCase() + this.gameStatus.slice(1);
        
        if (this.gameMode === 'ai') {
            document.getElementById('game-mode').textContent = `Human vs AI (AI plays ${this.aiColor})`;
            document.getElementById('ai-info').style.display = 'block';
            document.getElementById('ai-difficulty-display').textContent = this.aiDifficulty;
            
            // Show whose turn indicator for AI games
            const turnIndicator = this.currentPlayer === this.aiColor ? '🤖 AI\'s Turn' : '👤 Your Turn';
            const statusElement = document.getElementById('game-status');
            if (this.gameStatus === 'playing') {
                statusElement.textContent = turnIndicator;
                statusElement.style.color = this.currentPlayer === this.aiColor ? '#ff6b35' : '#4ecdc4';
            }
        } else {
            document.getElementById('game-mode').textContent = 'Human vs Human';
            document.getElementById('ai-info').style.display = 'none';
        }
        
        // Update board orientation hint
        this.updateBoardHints();
    }
    
    updateBoardHints() {
        // Add subtle hints about piece movement
        if (this.gameStatus === 'playing') {
            const pieces = document.querySelectorAll('.piece');
            pieces.forEach(piece => {
                const square = piece.parentElement;
                const row = parseInt(square.dataset.row);
                const col = parseInt(square.dataset.col);
                const boardPiece = this.board[row][col];
                
                if (boardPiece && boardPiece.color === this.currentPlayer) {
                    piece.style.cursor = 'pointer';
                    piece.title = `Click to move this ${boardPiece.type}`;
                } else {
                    piece.style.cursor = 'default';
                    piece.title = '';
                }
            });
        }
    }
    
    showAIThinking(show) {
        document.getElementById('ai-status').style.display = show ? 'block' : 'none';
    }
    
    showMoveProcessing(show) {
        if (show) {
            // Add a subtle loading indicator
            document.body.style.cursor = 'wait';
            const selected = document.querySelector('.square.selected');
            if (selected) {
                selected.style.opacity = '0.7';
            }
        } else {
            // Remove loading indicator
            document.body.style.cursor = 'default';
            const selected = document.querySelector('.square.selected');
            if (selected) {
                selected.style.opacity = '1';
            }
        }
    }
    
    attachEventListeners() {
        // New Game (PvP) button
        document.getElementById('new-game-btn').addEventListener('click', () => {
            this.createGame('pvp');
        });
        
        // AI Game button
        document.getElementById('ai-game-btn').addEventListener('click', () => {
            document.getElementById('ai-setup-modal').style.display = 'block';
        });
        
        // AI setup modal
        const modal = document.getElementById('ai-setup-modal');
        const closeBtn = modal.querySelector('.close');
        const cancelBtn = document.getElementById('cancel-ai-setup');
        const startBtn = document.getElementById('start-ai-game');
        const difficultySlider = document.getElementById('ai-difficulty');
        const difficultyValue = document.getElementById('difficulty-value');
        
        closeBtn.addEventListener('click', () => {
            modal.style.display = 'none';
        });
        
        cancelBtn.addEventListener('click', () => {
            modal.style.display = 'none';
        });
        
        startBtn.addEventListener('click', () => {
            const aiColor = document.getElementById('ai-color').value;
            const difficulty = parseInt(difficultySlider.value);
            
            const aiSettings = {
                color: aiColor,
                difficulty: difficulty,
                maxDepth: Math.min(12 + Math.floor(difficulty / 3), 18),
                timeLimit: 1000 + (difficulty * 100)
            };
            
            this.createGame('ai', aiSettings);
            modal.style.display = 'none';
        });
        
        difficultySlider.addEventListener('input', () => {
            difficultyValue.textContent = difficultySlider.value;
        });
        
        // Undo button (placeholder)
        document.getElementById('undo-btn').addEventListener('click', () => {
            console.log('Undo not implemented yet');
        });
        
        // Close modal when clicking outside
        window.addEventListener('click', (event) => {
            if (event.target === modal) {
                modal.style.display = 'none';
            }
        });
    }
}

// Initialize the game when the page loads
document.addEventListener('DOMContentLoaded', () => {
    window.chessGame = new ChessGameClient();
});
