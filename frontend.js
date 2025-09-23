class ChessGameClient {
    constructor() {
        this.gameId = null;
        this.board = [];
        this.currentPlayer = 'white';
        this.selectedSquare = null;
        this.gameStatus = 'waiting'; // Changed from 'playing' to 'waiting'
        this.gameMode = 'pvp';
        this.aiColor = '';
        this.aiDifficulty = 8;
        this.aiThinking = false;
        this.ws = null;
        
        // Board rotation and move history
        this.boardRotated = false; // false = white on bottom, true = black on bottom
        this.moveHistory = []; // Store all moves for notation
        this.fullMoveNumber = 1; // Full move counter
        
        // Visual enhancements inspired by gchessboard
        this.arrows = []; // Store arrows for move visualization
        this.highlightedSquares = new Set(); // Custom square highlights
        this.lastMoveHighlight = null; // Highlight last move
        this.showMoveHighlighting = true; // Toggle for move highlighting
        
        // Captured pieces tracking
        this.capturedPieces = {
            white: [],
            black: []
        };
        
        // Track castling rights and en passant
        this.castlingRights = {
            white: { kingside: true, queenside: true },
            black: { kingside: true, queenside: true }
        };
        this.enPassantTarget = null; // Square where en passant capture is possible
        this.lastMove = null; // Track last move for en passant
        
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
        this.updateUI();
        this.updateCoordinateLabels();
        this.attachEventListeners();
        this.setupKeyboardNavigation();
        // No backend - pure frontend chess game
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
    
    // WebSocket functionality removed - pure frontend implementation
    
    createGame(mode, aiSettings = null) {
        // Pure frontend game - no backend needed
        this.gameId = 'local-' + Math.random().toString(36).substr(2, 9);
        this.gameMode = mode;
        this.gameStatus = 'playing';
        this.currentPlayer = 'white';
        
        if (aiSettings) {
            this.aiColor = aiSettings.color;
            this.aiDifficulty = aiSettings.difficulty;
        }
        
        // Reset board to starting position
        this.initializeBoard();
        
        // Reset castling rights and en passant
        this.castlingRights = {
            white: { kingside: true, queenside: true },
            black: { kingside: true, queenside: true }
        };
        this.enPassantTarget = null;
        this.lastMove = null;
        this.moveHistory = [];
        this.fullMoveNumber = 1;
        this.capturedPieces = {
            white: [],
            black: []
        };
        
        this.renderBoard();
        this.updateUI();
        
        // If AI plays white, make first move
        if (mode === 'ai' && aiSettings && aiSettings.color === 'white') {
            setTimeout(() => this.makeStockfishAIMove(), 1000);
        }
        
        return true;
    }
    
    makeMove(from, to, promotion = null) {
        if (!this.gameId) {
            console.error('No active game');
            this.showErrorMessage('No active game');
            return false;
        }
        
        // Parse move coordinates
        const fromCoords = this.parseSquareNotation(from);
        const toCoords = this.parseSquareNotation(to);
        
        if (!fromCoords || !toCoords) {
            this.showErrorMessage('Invalid move notation');
            return false;
        }
        
        const piece = this.board[fromCoords.row][fromCoords.col];
        if (!piece || piece.color !== this.currentPlayer) {
            this.showErrorMessage('No piece to move or wrong color');
            return false;
        }
        
        // Validate the move is legal for this piece
        if (!this.isValidMove(fromCoords, toCoords, piece)) {
            this.showErrorMessage('Illegal move for this piece');
            return false;
        }
        
        // Store move info for tracking
        const moveInfo = {
            from: from,
            to: to,
            piece: piece.type,
            color: piece.color,
            fromCoords: fromCoords,
            toCoords: toCoords,
            captured: this.board[toCoords.row][toCoords.col]
        };
        
        // Handle special moves before executing
        const isEnPassant = this.isEnPassantCapture(fromCoords, toCoords, piece);
        const isCastling = this.isCastlingMove(fromCoords, toCoords, piece);
        
        // Execute the move
        this.board[toCoords.row][toCoords.col] = piece;
        this.board[fromCoords.row][fromCoords.col] = null;
        
        // Handle captured pieces
        if (moveInfo.captured) {
            this.capturedPieces[moveInfo.captured.color].push(moveInfo.captured);
        }
        
        // Handle en passant capture
        if (isEnPassant) {
            const capturedPawnRow = fromCoords.row;
            const capturedPawn = this.board[capturedPawnRow][toCoords.col];
            if (capturedPawn) {
                this.capturedPieces[capturedPawn.color].push(capturedPawn);
            }
            this.board[capturedPawnRow][toCoords.col] = null;
        }
        
        // Handle castling - move the rook
        if (isCastling) {
            const isKingside = toCoords.col > fromCoords.col;
            const rookFromCol = isKingside ? 7 : 0;
            const rookToCol = isKingside ? 5 : 3;
            const rook = this.board[fromCoords.row][rookFromCol];
            this.board[fromCoords.row][rookToCol] = rook;
            this.board[fromCoords.row][rookFromCol] = null;
        }
        
        // Handle pawn promotion
        let isPromotion = false;
        if (piece.type === 'pawn' && (toCoords.row === 0 || toCoords.row === 7)) {
            isPromotion = true;
            if (promotion) {
                // Promotion piece already chosen (e.g., from AI)
                this.board[toCoords.row][toCoords.col].type = promotion;
            } else {
                // Show promotion modal for human player
                this.showPromotionModal(toCoords.row, toCoords.col);
                return true; // Exit early, promotion will complete the move
            }
        }
        
        // Update castling rights
        this.updateCastlingRights(moveInfo);
        
        // Update en passant target
        this.updateEnPassantTarget(moveInfo);
        
        // Store last move
        this.lastMove = moveInfo;
        
        // Add move to history for notation (only if not a promotion waiting for user input)
        if (!isPromotion || promotion) {
            this.addMoveToHistory(moveInfo, isEnPassant, isCastling, promotion);
        }
        
        // Update last move highlight
        this.updateLastMoveHighlight(fromCoords, toCoords);
        
        // Switch players
        this.currentPlayer = this.currentPlayer === 'white' ? 'black' : 'white';
        
        // Clear selection
        this.clearSelection();
        this.renderBoard();
        this.updateUI();
        
        // Clear any error messages
        this.clearErrorMessage();
        
        console.log(`Move made: ${from} -> ${to}`);
        
        // Check if AI should move next
        if (this.gameMode === 'ai' && 
            this.currentPlayer === this.aiColor && 
            this.gameStatus === 'playing') {
            setTimeout(() => this.makeStockfishAIMove(), 1000);
        }
        
        return true;
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
    
    async makeStockfishAIMove() {
        if (!this.gameId || this.aiThinking) {
            return;
        }
        
        this.aiThinking = true;
        this.showAIThinking(true);
        
        try {
            // Get current position in FEN format
            const fen = this.generateFEN();
            
            // Calculate depth based on difficulty (1-20 maps to 1-18)
            const depth = Math.min(Math.max(this.aiDifficulty, 1), 18);
            
            console.log(`AI thinking... Difficulty: ${this.aiDifficulty}, Depth: ${depth}`);
            
            // Call Chess-API.com for Stockfish analysis
            const response = await fetch('https://chess-api.com/v1', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    fen: fen,
                    depth: depth,
                    maxThinkingTime: 50 + (this.aiDifficulty * 5) // More thinking time for higher difficulty
                })
            });
            
            const data = await response.json();
            
            if (data && data.move) {
                // Parse the move from Chess-API (e.g., "e2e4" format)
                const move = data.move;
                const from = move.substring(0, 2);
                const to = move.substring(2, 4);
                const promotion = move.length > 4 ? move.substring(4) : null;
                
                console.log(`Stockfish suggests: ${from} -> ${to} (eval: ${data.eval}, depth: ${data.depth})`);
                
                // Make the AI move
                this.makeMove(from, to, promotion);
            } else {
                console.error('No valid move from Chess-API, falling back to random');
                this.makeRandomAIMove();
            }
        } catch (error) {
            console.error('Chess-API error, falling back to random move:', error);
            this.makeRandomAIMove();
        } finally {
            this.aiThinking = false;
            this.showAIThinking(false);
        }
    }
    
    makeRandomAIMove() {
        // Fallback function for when Chess-API is unavailable
        const possibleMoves = this.getAllPossibleMoves(this.aiColor);
        
        if (possibleMoves.length > 0) {
            const randomMove = possibleMoves[Math.floor(Math.random() * possibleMoves.length)];
            setTimeout(() => {
                this.makeMove(randomMove.from, randomMove.to);
            }, 500 + Math.random() * 1000);
        } else {
            console.log('No possible moves for AI');
        }
    }
    
    getAllPossibleMoves(color) {
        const moves = [];
        
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = this.board[row][col];
                if (piece && piece.color === color) {
                    const validMoves = this.getValidMovesForPiece(piece, row, col);
                    validMoves.forEach(move => {
                        moves.push({
                            from: this.getSquareNotation(row, col),
                            to: this.getSquareNotation(move.row, move.col)
                        });
                    });
                }
            }
        }
        
        return moves;
    }
    
    parseSquareNotation(notation) {
        if (!notation || notation.length !== 2) return null;
        
        const files = 'abcdefgh';
        const ranks = '87654321';
        
        const col = files.indexOf(notation[0]);
        const row = ranks.indexOf(notation[1]);
        
        if (col === -1 || row === -1) return null;
        
        return { row, col };
    }
    
    isValidMove(fromCoords, toCoords, piece) {
        const { row: fromRow, col: fromCol } = fromCoords;
        const { row: toRow, col: toCol } = toCoords;
        
        // Can't move to same square
        if (fromRow === toRow && fromCol === toCol) return false;
        
        // Can't capture own piece
        const targetPiece = this.board[toRow][toCol];
        if (targetPiece && targetPiece.color === piece.color) return false;
        
        // Check piece-specific movement rules
        switch (piece.type) {
            case 'pawn':
                return this.isValidPawnMove(fromRow, fromCol, toRow, toCol, piece.color);
            case 'rook':
                return this.isValidRookMove(fromRow, fromCol, toRow, toCol);
            case 'knight':
                return this.isValidKnightMove(fromRow, fromCol, toRow, toCol);
            case 'bishop':
                return this.isValidBishopMove(fromRow, fromCol, toRow, toCol);
            case 'queen':
                return this.isValidQueenMove(fromRow, fromCol, toRow, toCol);
            case 'king':
                return this.isValidKingMove(fromRow, fromCol, toRow, toCol);
            default:
                return false;
        }
    }
    
    isValidPawnMove(fromRow, fromCol, toRow, toCol, color) {
        const direction = color === 'white' ? -1 : 1;
        const startRow = color === 'white' ? 6 : 1;
        const rowDiff = toRow - fromRow;
        const colDiff = Math.abs(toCol - fromCol);
        
        // Forward move
        if (fromCol === toCol) {
            // One square forward
            if (rowDiff === direction && !this.board[toRow][toCol]) {
                return true;
            }
            // Two squares forward from starting position
            if (fromRow === startRow && rowDiff === 2 * direction && !this.board[toRow][toCol]) {
                return true;
            }
        }
        // Diagonal capture
        else if (colDiff === 1 && rowDiff === direction) {
            // Regular capture
            if (this.board[toRow][toCol] != null) {
                return true;
            }
            // En passant capture
            if (this.enPassantTarget && 
                this.getSquareNotation(toRow, toCol) === this.enPassantTarget) {
                return true;
            }
        }
        
        return false;
    }
    
    isValidRookMove(fromRow, fromCol, toRow, toCol) {
        // Must move in straight line (horizontal or vertical)
        if (fromRow !== toRow && fromCol !== toCol) return false;
        
        // Check path is clear
        return this.isPathClear(fromRow, fromCol, toRow, toCol);
    }
    
    isValidKnightMove(fromRow, fromCol, toRow, toCol) {
        const rowDiff = Math.abs(toRow - fromRow);
        const colDiff = Math.abs(toCol - fromCol);
        
        // Knight moves in L-shape: 2+1 or 1+2
        return (rowDiff === 2 && colDiff === 1) || (rowDiff === 1 && colDiff === 2);
    }
    
    isValidBishopMove(fromRow, fromCol, toRow, toCol) {
        const rowDiff = Math.abs(toRow - fromRow);
        const colDiff = Math.abs(toCol - fromCol);
        
        // Must move diagonally
        if (rowDiff !== colDiff) return false;
        
        // Check path is clear
        return this.isPathClear(fromRow, fromCol, toRow, toCol);
    }
    
    isValidQueenMove(fromRow, fromCol, toRow, toCol) {
        // Queen combines rook and bishop moves
        return this.isValidRookMove(fromRow, fromCol, toRow, toCol) || 
               this.isValidBishopMove(fromRow, fromCol, toRow, toCol);
    }
    
    isValidKingMove(fromRow, fromCol, toRow, toCol) {
        const rowDiff = Math.abs(toRow - fromRow);
        const colDiff = Math.abs(toCol - fromCol);
        
        // Normal king move - one square in any direction
        if (rowDiff <= 1 && colDiff <= 1) {
            return true;
        }
        
        // Check for castling
        if (rowDiff === 0 && colDiff === 2) {
            return this.canCastle(fromRow, fromCol, toRow, toCol);
        }
        
        return false;
    }
    
    isPathClear(fromRow, fromCol, toRow, toCol) {
        const rowStep = toRow > fromRow ? 1 : toRow < fromRow ? -1 : 0;
        const colStep = toCol > fromCol ? 1 : toCol < fromCol ? -1 : 0;
        
        let currentRow = fromRow + rowStep;
        let currentCol = fromCol + colStep;
        
        // Check each square in the path (excluding start and end)
        while (currentRow !== toRow || currentCol !== toCol) {
            if (this.board[currentRow][currentCol] != null) {
                return false; // Path is blocked
            }
            currentRow += rowStep;
            currentCol += colStep;
        }
        
        return true;
    }
    
    generateFEN() {
        // Generate FEN string from current board position
        let fen = '';
        
        // 1. Piece placement
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
        
        // 2. Active color
        fen += ` ${this.currentPlayer.charAt(0)}`;
        
        // 3. Castling availability (simplified - assume none for now)
        fen += ' -';
        
        // 4. En passant target square (simplified - assume none)
        fen += ' -';
        
        // 5. Halfmove clock (simplified)
        fen += ' 0';
        
        // 6. Fullmove number (simplified)
        fen += ' 1';
        
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
    
    // Castling helper functions
    canCastle(fromRow, fromCol, toRow, toCol) {
        const color = this.currentPlayer;
        const isKingside = toCol > fromCol;
        
        // Check if castling rights are still available
        if (!this.castlingRights[color][isKingside ? 'kingside' : 'queenside']) {
            return false;
        }
        
        // Check if path is clear
        const startCol = Math.min(fromCol, toCol);
        const endCol = Math.max(fromCol, toCol);
        for (let col = startCol + 1; col < endCol; col++) {
            if (this.board[fromRow][col] != null) {
                return false;
            }
        }
        
        // For queenside castling, also check the b-file
        if (!isKingside && this.board[fromRow][1] != null) {
            return false;
        }
        
        // TODO: Check if king is in check or would pass through check
        // For now, just allow the move if path is clear
        
        return true;
    }
    
    isCastlingMove(fromCoords, toCoords, piece) {
        if (piece.type !== 'king') return false;
        const colDiff = Math.abs(toCoords.col - fromCoords.col);
        return colDiff === 2;
    }
    
    updateCastlingRights(moveInfo) {
        const { piece, color, fromCoords, toCoords } = moveInfo;
        
        // King moves remove all castling rights
        if (piece === 'king') {
            this.castlingRights[color].kingside = false;
            this.castlingRights[color].queenside = false;
        }
        
        // Rook moves remove castling rights for that side
        if (piece === 'rook') {
            if (fromCoords.col === 0) { // Queenside rook
                this.castlingRights[color].queenside = false;
            } else if (fromCoords.col === 7) { // Kingside rook
                this.castlingRights[color].kingside = false;
            }
        }
        
        // Capturing a rook removes opponent's castling rights
        if (moveInfo.captured && moveInfo.captured.type === 'rook') {
            const opponentColor = color === 'white' ? 'black' : 'white';
            if (toCoords.col === 0) {
                this.castlingRights[opponentColor].queenside = false;
            } else if (toCoords.col === 7) {
                this.castlingRights[opponentColor].kingside = false;
            }
        }
    }
    
    // En passant helper functions
    isEnPassantCapture(fromCoords, toCoords, piece) {
        if (piece.type !== 'pawn') return false;
        
        const colDiff = Math.abs(toCoords.col - fromCoords.col);
        if (colDiff !== 1) return false;
        
        // Check if moving to en passant target square
        return this.enPassantTarget && 
               this.getSquareNotation(toCoords.row, toCoords.col) === this.enPassantTarget;
    }
    
    updateEnPassantTarget(moveInfo) {
        const { piece, color, fromCoords, toCoords } = moveInfo;
        
        // Clear previous en passant target
        this.enPassantTarget = null;
        
        // Set en passant target if pawn moved two squares
        if (piece === 'pawn') {
            const rowDiff = Math.abs(toCoords.row - fromCoords.row);
            if (rowDiff === 2) {
                // En passant target is the square the pawn passed over
                const targetRow = (fromCoords.row + toCoords.row) / 2;
                this.enPassantTarget = this.getSquareNotation(targetRow, toCoords.col);
            }
        }
    }
    
    renderBoard() {
        const boardElement = document.getElementById('chess-board');
        if (!boardElement) {
            console.error('Chess board element not found!');
            return;
        }
        
        console.log('Rendering board...', this.board); // Debug log
        boardElement.innerHTML = '';
        
        for (let displayRow = 0; displayRow < 8; displayRow++) {
            for (let displayCol = 0; displayCol < 8; displayCol++) {
                // Get logical coordinates based on rotation
                const { row, col } = this.getLogicalCoords(displayRow, displayCol);
                
                const square = document.createElement('div');
                square.className = `square ${(displayRow + displayCol) % 2 === 0 ? 'light' : 'dark'}`;
                // Store logical coordinates in dataset
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
        
        console.log('Board rendered with', boardElement.children.length, 'squares'); // Debug log
        
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
    
    // Get display coordinates for board rendering (handles rotation)
    getDisplayCoords(row, col) {
        if (this.boardRotated) {
            return {
                displayRow: 7 - row,
                displayCol: 7 - col
            };
        }
        return {
            displayRow: row,
            displayCol: col
        };
    }
    
    // Convert display coordinates back to logical coordinates
    getLogicalCoords(displayRow, displayCol) {
        if (this.boardRotated) {
            return {
                row: 7 - displayRow,
                col: 7 - displayCol
            };
        }
        return {
            row: displayRow,
            col: displayCol
        };
    }
    
    // Board rotation function
    rotateBoard() {
        this.boardRotated = !this.boardRotated;
        this.clearSelection();
        this.renderBoard();
        this.updateCoordinateLabels();
        console.log('Board rotated:', this.boardRotated ? 'Black on bottom' : 'White on bottom');
    }
    
    // Update coordinate labels based on board rotation
    updateCoordinateLabels() {
        const files = this.boardRotated ? ['h', 'g', 'f', 'e', 'd', 'c', 'b', 'a'] : ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
        const ranks = this.boardRotated ? ['1', '2', '3', '4', '5', '6', '7', '8'] : ['8', '7', '6', '5', '4', '3', '2', '1'];
        
        // Update file labels (bottom only)
        const bottomFiles = document.querySelectorAll('#bottom-files .file-label');
        
        bottomFiles.forEach((label, index) => {
            label.textContent = files[index];
        });
        
        // Update rank labels (left and right)
        const leftRanks = document.querySelectorAll('#left-ranks .rank-label');
        const rightRanks = document.querySelectorAll('#right-ranks .rank-label');
        
        leftRanks.forEach((label, index) => {
            label.textContent = ranks[index];
        });
        
        rightRanks.forEach((label, index) => {
            label.textContent = ranks[index];
        });
    }
    
    // Chess notation functions
    addMoveToHistory(moveInfo, isEnPassant, isCastling, promotion) {
        const notation = this.generateMoveNotation(moveInfo, isEnPassant, isCastling, promotion);
        
        this.moveHistory.push({
            from: moveInfo.from,
            to: moveInfo.to,
            notation: notation,
            color: moveInfo.color,
            moveNumber: this.fullMoveNumber
        });
        
        // Increment full move number after black moves
        if (moveInfo.color === 'black') {
            this.fullMoveNumber++;
        }
        
        this.updateMoveHistoryDisplay();
    }
    
    generateMoveNotation(moveInfo, isEnPassant, isCastling, promotion) {
        const { piece, color, from, to, captured } = moveInfo;
        
        // Handle castling
        if (isCastling) {
            const toCol = this.parseSquareNotation(to).col;
            return toCol > 4 ? 'O-O' : 'O-O-O'; // Kingside or queenside
        }
        
        let notation = '';
        
        // Piece letter (except for pawns)
        if (piece !== 'pawn') {
            const pieceLetters = {
                'king': 'K', 'queen': 'Q', 'rook': 'R',
                'bishop': 'B', 'knight': 'N'
            };
            notation += pieceLetters[piece];
        }
        
        // For disambiguating moves (simplified - could be enhanced)
        // This would need more complex logic to check for ambiguous moves
        
        // Capture notation
        if (captured || isEnPassant) {
            if (piece === 'pawn') {
                notation += from[0]; // File of capturing pawn
            }
            notation += 'x';
        }
        
        // Destination square
        notation += to;
        
        // En passant
        if (isEnPassant) {
            notation += ' e.p.';
        }
        
        // Promotion
        if (promotion) {
            const pieceLetters = {
                'queen': 'Q', 'rook': 'R', 'bishop': 'B', 'knight': 'N'
            };
            notation += '=' + pieceLetters[promotion];
        }
        
        // TODO: Add check/checkmate indicators (+, #)
        
        return notation;
    }
    
    updateMoveHistoryDisplay() {
        const historyElement = document.getElementById('move-history');
        if (!historyElement) return;
        
        historyElement.innerHTML = '';
        
        // Group moves by full move number
        const groupedMoves = {};
        this.moveHistory.forEach(move => {
            if (!groupedMoves[move.moveNumber]) {
                groupedMoves[move.moveNumber] = {};
            }
            groupedMoves[move.moveNumber][move.color] = move;
        });
        
        // Display moves
        Object.keys(groupedMoves).forEach(moveNum => {
            const moves = groupedMoves[moveNum];
            
            // Move number
            const numberElement = document.createElement('div');
            numberElement.className = 'move-number';
            numberElement.textContent = moveNum + '.';
            historyElement.appendChild(numberElement);
            
            // White move
            const whiteElement = document.createElement('div');
            whiteElement.className = 'move-white';
            whiteElement.textContent = moves.white ? moves.white.notation : '';
            if (moves.white) {
                whiteElement.title = `${moves.white.from} → ${moves.white.to}`;
            }
            historyElement.appendChild(whiteElement);
            
            // Black move
            const blackElement = document.createElement('div');
            blackElement.className = 'move-black';
            blackElement.textContent = moves.black ? moves.black.notation : '';
            if (moves.black) {
                blackElement.title = `${moves.black.from} → ${moves.black.to}`;
            }
            historyElement.appendChild(blackElement);
        });
        
        // Auto-scroll to bottom
        historyElement.scrollTop = historyElement.scrollHeight;
    }
    
    // Enhanced visual features inspired by gchessboard
    drawArrow(fromSquare, toSquare, brush = 'primary') {
        const svg = document.getElementById('board-svg');
        if (!svg) return;
        
        const fromCoords = this.parseSquareNotation(fromSquare);
        const toCoords = this.parseSquareNotation(toSquare);
        if (!fromCoords || !toCoords) return;
        
        // Convert to display coordinates
        const fromDisplay = this.getDisplayCoords(fromCoords.row, fromCoords.col);
        const toDisplay = this.getDisplayCoords(toCoords.row, toCoords.col);
        
        // Calculate pixel positions (60px per square)
        const fromX = (fromDisplay.displayCol * 60) + 30;
        const fromY = (fromDisplay.displayRow * 60) + 30;
        const toX = (toDisplay.displayCol * 60) + 30;
        const toY = (toDisplay.displayRow * 60) + 30;
        
        // Create arrow line
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', fromX);
        line.setAttribute('y1', fromY);
        line.setAttribute('x2', toX);
        line.setAttribute('y2', toY);
        line.setAttribute('stroke', brush === 'secondary' ? '#FF9800' : '#4CAF50');
        line.setAttribute('stroke-width', '6');
        line.setAttribute('stroke-linecap', 'round');
        line.setAttribute('opacity', '0.8');
        line.setAttribute('marker-end', `url(#arrowhead${brush === 'secondary' ? '-secondary' : ''})`);
        line.classList.add('board-arrow', `arrow-${brush}`);
        
        svg.appendChild(line);
        
        // Store arrow data
        this.arrows.push({
            from: fromSquare,
            to: toSquare,
            brush: brush,
            element: line
        });
    }
    
    clearArrows() {
        const svg = document.getElementById('board-svg');
        if (!svg) return;
        
        // Remove all arrow elements
        const arrows = svg.querySelectorAll('.board-arrow');
        arrows.forEach(arrow => arrow.remove());
        
        // Clear arrows array
        this.arrows = [];
    }
    
    updateLastMoveHighlight(fromCoords, toCoords) {
        // Store the last move coordinates for toggling
        this.lastMoveHighlight = { fromCoords, toCoords };
        
        // Apply highlighting if enabled
        this.applyMoveHighlighting();
    }
    
    applyMoveHighlighting() {
        // Clear previous highlights and arrows
        this.clearMoveHighlighting();
        
        // Only apply if highlighting is enabled and we have a last move
        if (!this.showMoveHighlighting || !this.lastMoveHighlight) {
            return;
        }
        
        const { fromCoords, toCoords } = this.lastMoveHighlight;
        
        // Add last move highlight to from and to squares
        const fromSquare = document.querySelector(`[data-row="${fromCoords.row}"][data-col="${fromCoords.col}"]`);
        const toSquare = document.querySelector(`[data-row="${toCoords.row}"][data-col="${toCoords.col}"]`);
        
        if (fromSquare) fromSquare.classList.add('last-move');
        if (toSquare) toSquare.classList.add('last-move');
        
        // Draw arrow for the last move
        const fromNotation = this.getSquareNotation(fromCoords.row, fromCoords.col);
        const toNotation = this.getSquareNotation(toCoords.row, toCoords.col);
        this.drawArrow(fromNotation, toNotation, 'primary');
    }
    
    clearMoveHighlighting() {
        // Clear previous last move highlights
        document.querySelectorAll('.square.last-move').forEach(sq => {
            sq.classList.remove('last-move');
        });
        
        // Clear arrows
        this.clearArrows();
    }
    
    toggleMoveHighlighting() {
        this.showMoveHighlighting = !this.showMoveHighlighting;
        this.applyMoveHighlighting();
        this.updateToggleButtonState();
        
        console.log('Move highlighting:', this.showMoveHighlighting ? 'enabled' : 'disabled');
    }
    
    updateToggleButtonState() {
        const toggleBtn = document.getElementById('toggle-move-highlight-btn');
        const toggleIcon = toggleBtn.querySelector('.toggle-icon');
        
        if (this.showMoveHighlighting) {
            toggleBtn.classList.add('active');
            toggleBtn.innerHTML = '<span class="toggle-icon">👁️</span> Show Moves';
        } else {
            toggleBtn.classList.remove('active');
            toggleBtn.innerHTML = '<span class="toggle-icon">🙈</span> Hide Moves';
        }
    }
    
    // Add suggested moves visualization
    showSuggestedMoves(moves) {
        // Clear previous suggestions
        document.querySelectorAll('.square.suggested-move').forEach(sq => {
            sq.classList.remove('suggested-move');
        });
        
        // Add suggestions
        moves.forEach(move => {
            const coords = this.parseSquareNotation(move.to);
            if (coords) {
                const square = document.querySelector(`[data-row="${coords.row}"][data-col="${coords.col}"]`);
                if (square) {
                    square.classList.add('suggested-move');
                }
            }
        });
    }
    
    // Update captured pieces display
    updateCapturedPiecesDisplay() {
        const whiteCapturedElement = document.getElementById('captured-white-pieces');
        const blackCapturedElement = document.getElementById('captured-black-pieces');
        
        if (!whiteCapturedElement || !blackCapturedElement) return;
        
        // Clear existing displays
        whiteCapturedElement.innerHTML = '';
        blackCapturedElement.innerHTML = '';
        
        // Display captured white pieces
        this.capturedPieces.white.forEach(piece => {
            const pieceElement = document.createElement('span');
            pieceElement.className = 'captured-piece';
            pieceElement.textContent = this.pieceSymbols.white[piece.type];
            pieceElement.title = `Captured ${piece.type}`;
            whiteCapturedElement.appendChild(pieceElement);
        });
        
        // Display captured black pieces
        this.capturedPieces.black.forEach(piece => {
            const pieceElement = document.createElement('span');
            pieceElement.className = 'captured-piece';
            pieceElement.textContent = this.pieceSymbols.black[piece.type];
            pieceElement.title = `Captured ${piece.type}`;
            blackCapturedElement.appendChild(pieceElement);
        });
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
        
        // Test all possible squares on the board
        for (let toRow = 0; toRow < 8; toRow++) {
            for (let toCol = 0; toCol < 8; toCol++) {
                if (this.isValidMove({row: fromRow, col: fromCol}, {row: toRow, col: toCol}, piece)) {
                    moves.push({row: toRow, col: toCol});
                }
            }
        }
        
        return moves;
    }
    
    // Old piece-specific movement functions removed - now using unified validation system
    
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
        
        const statusText = this.gameStatus === 'waiting' ? 'Ready to Play' : 
            this.gameStatus.charAt(0).toUpperCase() + this.gameStatus.slice(1);
        document.getElementById('game-status').textContent = statusText;
        
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
        
        // Update captured pieces display
        this.updateCapturedPiecesDisplay();
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
        const aiStatus = document.getElementById('ai-status');
        const aiThinking = document.getElementById('ai-thinking');
        
        if (show) {
            aiStatus.style.display = 'block';
            aiThinking.textContent = `Stockfish is analyzing... (Depth ${Math.min(this.aiDifficulty, 18)})`;
        } else {
            aiStatus.style.display = 'none';
        }
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
        
        // Rotate board button
        document.getElementById('rotate-board-btn').addEventListener('click', () => {
            this.rotateBoard();
        });
        
        // Move highlighting toggle button
        document.getElementById('toggle-move-highlight-btn').addEventListener('click', () => {
            this.toggleMoveHighlighting();
        });
        
        // Close modal when clicking outside
        window.addEventListener('click', (event) => {
            if (event.target === modal) {
                modal.style.display = 'none';
            }
        });
        
        // Promotion modal event listeners
        this.setupPromotionModal();
    }
    
    // Keyboard navigation inspired by gchessboard accessibility
    setupKeyboardNavigation() {
        this.focusedSquare = { row: 4, col: 4 }; // Start in center
        this.keyboardMode = false;
        
        // Make board focusable
        const boardElement = document.getElementById('chess-board');
        boardElement.setAttribute('tabindex', '0');
        boardElement.setAttribute('role', 'grid');
        boardElement.setAttribute('aria-label', 'Chess board');
        
        // Add keyboard event listeners
        boardElement.addEventListener('keydown', (e) => this.handleKeyboardInput(e));
        boardElement.addEventListener('focus', () => {
            this.keyboardMode = true;
            this.updateKeyboardFocus();
        });
        boardElement.addEventListener('blur', () => {
            this.keyboardMode = false;
            this.clearKeyboardFocus();
        });
    }
    
    handleKeyboardInput(event) {
        if (!this.keyboardMode || this.gameStatus !== 'playing') return;
        
        const { row, col } = this.focusedSquare;
        let newRow = row;
        let newCol = col;
        
        switch (event.key) {
            case 'ArrowUp':
                newRow = Math.max(0, row - 1);
                event.preventDefault();
                break;
            case 'ArrowDown':
                newRow = Math.min(7, row + 1);
                event.preventDefault();
                break;
            case 'ArrowLeft':
                newCol = Math.max(0, col - 1);
                event.preventDefault();
                break;
            case 'ArrowRight':
                newCol = Math.min(7, col + 1);
                event.preventDefault();
                break;
            case ' ':
            case 'Enter':
                this.handleKeyboardSquareSelect();
                event.preventDefault();
                break;
            case 'Escape':
                this.clearSelection();
                event.preventDefault();
                break;
        }
        
        if (newRow !== row || newCol !== col) {
            this.focusedSquare = { row: newRow, col: newCol };
            this.updateKeyboardFocus();
        }
    }
    
    handleKeyboardSquareSelect() {
        const { row, col } = this.focusedSquare;
        const square = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
        if (square) {
            square.click(); // Reuse existing click handler
        }
    }
    
    updateKeyboardFocus() {
        // Clear previous focus
        this.clearKeyboardFocus();
        
        const { row, col } = this.focusedSquare;
        const square = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
        if (square) {
            square.classList.add('keyboard-focused');
            
            // Add aria labels for accessibility
            const piece = this.board[row][col];
            const squareNotation = this.getSquareNotation(row, col);
            let label = `Square ${squareNotation}`;
            
            if (piece) {
                label += `, ${piece.color} ${piece.type}`;
            } else {
                label += ', empty';
            }
            
            square.setAttribute('aria-label', label);
        }
    }
    
    clearKeyboardFocus() {
        document.querySelectorAll('.square.keyboard-focused').forEach(sq => {
            sq.classList.remove('keyboard-focused');
        });
    }
    
    setupPromotionModal() {
        const promotionBtns = document.querySelectorAll('.promotion-btn');
        promotionBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const piece = e.currentTarget.dataset.piece;
                this.completePromotion(piece);
            });
        });
    }
    
    showPromotionModal(row, col) {
        this.promotionSquare = { row, col };
        const modal = document.getElementById('promotion-modal');
        const currentColor = this.board[row][col].color;
        
        // Update piece symbols for correct color
        const promotionPieces = document.querySelectorAll('.promotion-piece');
        const symbols = {
            queen: currentColor === 'white' ? '♕' : '♛',
            rook: currentColor === 'white' ? '♖' : '♜',
            bishop: currentColor === 'white' ? '♗' : '♝',
            knight: currentColor === 'white' ? '♘' : '♞'
        };
        
        promotionPieces.forEach(piece => {
            const btn = piece.parentElement;
            const pieceType = btn.dataset.piece;
            piece.textContent = symbols[pieceType];
        });
        
        modal.style.display = 'block';
    }
    
    completePromotion(pieceType) {
        if (!this.promotionSquare) return;
        
        const { row, col } = this.promotionSquare;
        
        // Complete the promotion
        this.board[row][col].type = pieceType;
        
        // Hide modal
        document.getElementById('promotion-modal').style.display = 'none';
        this.promotionSquare = null;
        
        // Continue with the rest of the move logic
        this.finalizeMoveAfterPromotion();
    }
    
    finalizeMoveAfterPromotion() {
        // Add the promotion move to history if we have lastMove
        if (this.lastMove) {
            this.addMoveToHistory(this.lastMove, false, false, this.board[this.lastMove.toCoords.row][this.lastMove.toCoords.col].type);
        }
        
        // Switch players
        this.currentPlayer = this.currentPlayer === 'white' ? 'black' : 'white';
        
        // Clear selection
        this.clearSelection();
        this.renderBoard();
        this.updateUI();
        
        // Clear any error messages
        this.clearErrorMessage();
        
        console.log(`Pawn promoted and move completed`);
        
        // Check if AI should move next
        if (this.gameMode === 'ai' && 
            this.currentPlayer === this.aiColor && 
            this.gameStatus === 'playing') {
            setTimeout(() => this.makeStockfishAIMove(), 1000);
        }
    }
}

// Initialize the game when the page loads
document.addEventListener('DOMContentLoaded', () => {
    window.chessGame = new ChessGameClient();
});
