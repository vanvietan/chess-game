class ChessGame {
    constructor() {
        this.board = [];
        this.currentPlayer = 'white';
        this.selectedSquare = null;
        this.gameStatus = 'playing';
        this.moveHistory = [];
        this.capturedPieces = { white: [], black: [] };
        this.inCheck = false;
        this.lastMove = null;
        
        // Castling rights
        this.castlingRights = {
            white: { kingside: true, queenside: true },
            black: { kingside: true, queenside: true }
        };
        
        // AI settings
        this.gameMode = 'pvp'; // 'pvp' or 'ai'
        this.aiColor = '';
        this.aiDifficulty = 8;
        this.stockfish = null;
        this.aiThinking = false;
        
        // Chess piece Unicode symbols
        this.pieceSymbols = {
            white: {
                king: '♔',
                queen: '♕',
                rook: '♖',
                bishop: '♗',
                knight: '♘',
                pawn: '♙'
            },
            black: {
                king: '♚',
                queen: '♛',
                rook: '♜',
                bishop: '♝',
                knight: '♞',
                pawn: '♟'
            }
        };
        
        this.initializeBoard();
        this.renderBoard();
        this.attachEventListeners();
        this.initializeStockfish();
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
    
    initializeStockfish() {
        // Stockfish is handled by the server, no client-side initialization needed
        console.log('AI ready - using server-side Stockfish');
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
                    pieceElement.setAttribute('data-color', piece.color);
                    pieceElement.setAttribute('data-type', piece.type);
                    pieceElement.textContent = this.pieceSymbols[piece.color][piece.type];
                    square.appendChild(pieceElement);
                }
                
                boardElement.appendChild(square);
            }
        }
        
        this.updateGameInfo();
    }
    
    attachEventListeners() {
        document.addEventListener('click', (e) => {
            if (e.target.closest('.square')) {
                this.handleSquareClick(e.target.closest('.square'));
            }
        });
        
        document.getElementById('new-game-btn').addEventListener('click', () => {
            this.newGame();
        });
        
        document.getElementById('ai-game-btn').addEventListener('click', () => {
            this.showAISetupModal();
        });
        
        document.getElementById('undo-btn').addEventListener('click', () => {
            this.undoMove();
        });
        
        // AI setup modal handlers
        document.getElementById('start-ai-game').addEventListener('click', () => {
            this.startAIGame();
        });
        
        document.getElementById('cancel-ai-setup').addEventListener('click', () => {
            this.hideAISetupModal();
        });
        
        document.querySelector('.close').addEventListener('click', () => {
            this.hideAISetupModal();
        });
        
        // Difficulty slider
        document.getElementById('ai-difficulty').addEventListener('input', (e) => {
            document.getElementById('difficulty-value').textContent = e.target.value;
        });
    }
    
    handleSquareClick(square) {
        if (this.gameStatus !== 'playing' || this.aiThinking) return;
        
        // Don't allow moves if it's AI's turn
        if (this.gameMode === 'ai' && this.currentPlayer === this.aiColor) return;
        
        const row = parseInt(square.dataset.row);
        const col = parseInt(square.dataset.col);
        
        if (this.selectedSquare) {
            if (this.selectedSquare.row === row && this.selectedSquare.col === col) {
                this.clearSelection();
            } else if (this.isValidMove(this.selectedSquare.row, this.selectedSquare.col, row, col)) {
                this.makeMove(this.selectedSquare.row, this.selectedSquare.col, row, col);
                this.clearSelection();
            } else {
                const piece = this.board[row][col];
                if (piece && piece.color === this.currentPlayer) {
                    this.selectSquare(row, col);
                } else {
                    this.clearSelection();
                }
            }
        } else {
            const piece = this.board[row][col];
            if (piece && piece.color === this.currentPlayer) {
                this.selectSquare(row, col);
            }
        }
    }
    
    selectSquare(row, col) {
        this.selectedSquare = { row, col };
        this.renderBoard();
        
        const square = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
        square.classList.add('selected');
        
        this.highlightPossibleMoves(row, col);
    }
    
    clearSelection() {
        this.selectedSquare = null;
        this.renderBoard();
    }
    
    highlightPossibleMoves(row, col) {
        const possibleMoves = this.getPossibleMoves(row, col);
        possibleMoves.forEach(move => {
            const square = document.querySelector(`[data-row="${move.row}"][data-col="${move.col}"]`);
            if (this.board[move.row][move.col]) {
                square.classList.add('possible-capture');
            } else {
                square.classList.add('possible-move');
            }
        });
    }
    
    getPossibleMoves(row, col) {
        const piece = this.board[row][col];
        if (!piece) return [];
        
        let moves = [];
        
        switch (piece.type) {
            case 'pawn':
                moves = this.getPawnMoves(row, col);
                break;
            case 'rook':
                moves = this.getRookMoves(row, col);
                break;
            case 'bishop':
                moves = this.getBishopMoves(row, col);
                break;
            case 'queen':
                moves = this.getQueenMoves(row, col);
                break;
            case 'king':
                moves = this.getKingMoves(row, col);
                break;
            case 'knight':
                moves = this.getKnightMoves(row, col);
                break;
        }
        
        return moves.filter(move => !this.wouldBeInCheck(row, col, move.row, move.col));
    }
    
    getPawnMoves(row, col) {
        const piece = this.board[row][col];
        const moves = [];
        const direction = piece.color === 'white' ? -1 : 1;
        const startRow = piece.color === 'white' ? 6 : 1;
        
        // Forward move
        if (this.isInBounds(row + direction, col) && !this.board[row + direction][col]) {
            moves.push({ row: row + direction, col });
            
            if (row === startRow && !this.board[row + 2 * direction][col]) {
                moves.push({ row: row + 2 * direction, col });
            }
        }
        
        // Captures
        for (const captureCol of [col - 1, col + 1]) {
            if (this.isInBounds(row + direction, captureCol)) {
                const target = this.board[row + direction][captureCol];
                if (target && target.color !== piece.color) {
                    moves.push({ row: row + direction, col: captureCol });
                }
            }
        }
        
        return moves;
    }
    
    getRookMoves(row, col) {
        return this.getLinearMoves(row, col, [[0, 1], [0, -1], [1, 0], [-1, 0]]);
    }
    
    getBishopMoves(row, col) {
        return this.getLinearMoves(row, col, [[1, 1], [1, -1], [-1, 1], [-1, -1]]);
    }
    
    getQueenMoves(row, col) {
        return this.getLinearMoves(row, col, [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [1, -1], [-1, 1], [-1, -1]]);
    }
    
    getLinearMoves(row, col, directions) {
        const piece = this.board[row][col];
        const moves = [];
        
        for (const [dRow, dCol] of directions) {
            for (let i = 1; i < 8; i++) {
                const newRow = row + i * dRow;
                const newCol = col + i * dCol;
                
                if (!this.isInBounds(newRow, newCol)) break;
                
                const target = this.board[newRow][newCol];
                if (!target) {
                    moves.push({ row: newRow, col: newCol });
                } else {
                    if (target.color !== piece.color) {
                        moves.push({ row: newRow, col: newCol });
                    }
                    break;
                }
            }
        }
        
        return moves;
    }
    
    getKingMoves(row, col) {
        const piece = this.board[row][col];
        const moves = [];
        const directions = [
            [-1, -1], [-1, 0], [-1, 1],
            [0, -1],           [0, 1],
            [1, -1],  [1, 0],  [1, 1]
        ];
        
        // Normal king moves
        for (const [dRow, dCol] of directions) {
            const newRow = row + dRow;
            const newCol = col + dCol;
            
            if (this.isInBounds(newRow, newCol)) {
                const target = this.board[newRow][newCol];
                if (!target || target.color !== piece.color) {
                    moves.push({ row: newRow, col: newCol });
                }
            }
        }
        
        // Castling moves
        if (!this.inCheck && this.canCastle(piece.color)) {
            // Kingside castling
            if (this.canCastleKingside(piece.color)) {
                moves.push({ row, col: col + 2, castling: 'kingside' });
            }
            
            // Queenside castling
            if (this.canCastleQueenside(piece.color)) {
                moves.push({ row, col: col - 2, castling: 'queenside' });
            }
        }
        
        return moves;
    }
    
    getKnightMoves(row, col) {
        const moves = [];
        const knightMoves = [
            [-2, -1], [-2, 1], [-1, -2], [-1, 2],
            [1, -2], [1, 2], [2, -1], [2, 1]
        ];
        
        for (const [dRow, dCol] of knightMoves) {
            const newRow = row + dRow;
            const newCol = col + dCol;
            
            if (this.isInBounds(newRow, newCol)) {
                const target = this.board[newRow][newCol];
                if (!target || target.color !== this.board[row][col].color) {
                    moves.push({ row: newRow, col: newCol });
                }
            }
        }
        
        return moves;
    }
    
    isInBounds(row, col) {
        return row >= 0 && row < 8 && col >= 0 && col < 8;
    }
    
    canCastle(color) {
        return this.castlingRights[color].kingside || this.castlingRights[color].queenside;
    }
    
    canCastleKingside(color) {
        if (!this.castlingRights[color].kingside) return false;
        
        const row = color === 'white' ? 7 : 0;
        
        // Check if squares between king and rook are empty
        for (let col = 5; col <= 6; col++) {
            if (this.board[row][col]) return false;
        }
        
        // Check if king would pass through check
        for (let col = 4; col <= 6; col++) {
            if (this.isSquareUnderAttack(row, col, color)) return false;
        }
        
        return true;
    }
    
    canCastleQueenside(color) {
        if (!this.castlingRights[color].queenside) return false;
        
        const row = color === 'white' ? 7 : 0;
        
        // Check if squares between king and rook are empty
        for (let col = 1; col <= 3; col++) {
            if (this.board[row][col]) return false;
        }
        
        // Check if king would pass through check
        for (let col = 2; col <= 4; col++) {
            if (this.isSquareUnderAttack(row, col, color)) return false;
        }
        
        return true;
    }
    
    executeCastling(fromRow, fromCol, toRow, toCol) {
        const piece = this.board[fromRow][fromCol];
        
        // Move the king
        this.board[toRow][toCol] = piece;
        this.board[fromRow][fromCol] = null;
        
        // Move the rook
        if (toCol > fromCol) {
            // Kingside castling
            const rook = this.board[fromRow][7];
            this.board[fromRow][5] = rook;
            this.board[fromRow][7] = null;
        } else {
            // Queenside castling
            const rook = this.board[fromRow][0];
            this.board[fromRow][3] = rook;
            this.board[fromRow][0] = null;
        }
    }
    
    updateCastlingRights(piece, fromRow, fromCol, toRow, toCol) {
        // If king moves, lose all castling rights for that color
        if (piece.type === 'king') {
            this.castlingRights[piece.color].kingside = false;
            this.castlingRights[piece.color].queenside = false;
        }
        
        // If rook moves from starting position, lose that side's castling
        if (piece.type === 'rook') {
            if (piece.color === 'white' && fromRow === 7) {
                if (fromCol === 0) this.castlingRights.white.queenside = false;
                if (fromCol === 7) this.castlingRights.white.kingside = false;
            } else if (piece.color === 'black' && fromRow === 0) {
                if (fromCol === 0) this.castlingRights.black.queenside = false;
                if (fromCol === 7) this.castlingRights.black.kingside = false;
            }
        }
        
        // If rook is captured, lose that side's castling
        const capturedPiece = this.board[toRow][toCol];
        if (capturedPiece && capturedPiece.type === 'rook') {
            if (capturedPiece.color === 'white' && toRow === 7) {
                if (toCol === 0) this.castlingRights.white.queenside = false;
                if (toCol === 7) this.castlingRights.white.kingside = false;
            } else if (capturedPiece.color === 'black' && toRow === 0) {
                if (toCol === 0) this.castlingRights.black.queenside = false;
                if (toCol === 7) this.castlingRights.black.kingside = false;
            }
        }
    }
    
    isValidMove(fromRow, fromCol, toRow, toCol) {
        const possibleMoves = this.getPossibleMoves(fromRow, fromCol);
        return possibleMoves.some(move => move.row === toRow && move.col === toCol);
    }
    
    makeMove(fromRow, fromCol, toRow, toCol) {
        const piece = this.board[fromRow][fromCol];
        const capturedPiece = this.board[toRow][toCol];
        
        // Check if this is a castling move
        const isCastling = piece.type === 'king' && Math.abs(toCol - fromCol) === 2;
        
        const move = {
            fromRow, fromCol, toRow, toCol,
            piece: { ...piece },
            capturedPiece: capturedPiece ? { ...capturedPiece } : null,
            castling: isCastling ? (toCol > fromCol ? 'kingside' : 'queenside') : null,
            castlingRights: JSON.parse(JSON.stringify(this.castlingRights)) // Save previous state
        };
        
        // Handle castling
        if (isCastling) {
            this.executeCastling(fromRow, fromCol, toRow, toCol);
        } else {
            // Make the normal move
            this.board[toRow][toCol] = piece;
            this.board[fromRow][fromCol] = null;
        }
        
        // Handle pawn promotion
        if (piece.type === 'pawn' && (toRow === 0 || toRow === 7)) {
            this.board[toRow][toCol] = { type: 'queen', color: piece.color };
        }
        
        // Add captured piece
        if (capturedPiece) {
            this.capturedPieces[capturedPiece.color].push(capturedPiece.type);
        }
        
        // Update castling rights
        this.updateCastlingRights(piece, fromRow, fromCol, toRow, toCol);
        
        this.moveHistory.push(move);
        this.lastMove = move;
        
        // Switch players
        this.currentPlayer = this.currentPlayer === 'white' ? 'black' : 'white';
        
        this.updateGameStatus();
        this.renderBoard();
        
        // If AI game and it's AI's turn, make AI move
        if (this.gameMode === 'ai' && this.currentPlayer === this.aiColor && this.gameStatus === 'playing') {
            this.makeAIMove();
        }
    }
    
    wouldBeInCheck(fromRow, fromCol, toRow, toCol) {
        const originalPiece = this.board[toRow][toCol];
        const movingPiece = this.board[fromRow][fromCol];
        
        this.board[toRow][toCol] = movingPiece;
        this.board[fromRow][fromCol] = null;
        
        const kingPos = this.findKing(movingPiece.color);
        const inCheck = this.isSquareUnderAttack(kingPos.row, kingPos.col, movingPiece.color);
        
        this.board[fromRow][fromCol] = movingPiece;
        this.board[toRow][toCol] = originalPiece;
        
        return inCheck;
    }
    
    findKing(color) {
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = this.board[row][col];
                if (piece && piece.type === 'king' && piece.color === color) {
                    return { row, col };
                }
            }
        }
    }
    
    isSquareUnderAttack(row, col, defenderColor) {
        const attackerColor = defenderColor === 'white' ? 'black' : 'white';
        
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const piece = this.board[r][c];
                if (piece && piece.color === attackerColor) {
                    const moves = this.getPossibleMovesWithoutCheckValidation(r, c);
                    if (moves.some(move => move.row === row && move.col === col)) {
                        return true;
                    }
                }
            }
        }
        
        return false;
    }
    
    getPossibleMovesWithoutCheckValidation(row, col) {
        const piece = this.board[row][col];
        if (!piece) return [];
        
        switch (piece.type) {
            case 'pawn': return this.getPawnMoves(row, col);
            case 'rook': return this.getRookMoves(row, col);
            case 'bishop': return this.getBishopMoves(row, col);
            case 'queen': return this.getQueenMoves(row, col);
            case 'king': return this.getKingMoves(row, col);
            case 'knight': return this.getKnightMoves(row, col);
            default: return [];
        }
    }
    
    updateGameStatus() {
        const kingPos = this.findKing(this.currentPlayer);
        this.inCheck = this.isSquareUnderAttack(kingPos.row, kingPos.col, this.currentPlayer);
        
        let hasLegalMoves = false;
        
        outerLoop:
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const piece = this.board[row][col];
                if (piece && piece.color === this.currentPlayer) {
                    const moves = this.getPossibleMoves(row, col);
                    if (moves.length > 0) {
                        hasLegalMoves = true;
                        break outerLoop;
                    }
                }
            }
        }
        
        if (!hasLegalMoves) {
            if (this.inCheck) {
                this.gameStatus = `checkmate-${this.currentPlayer === 'white' ? 'black' : 'white'}`;
            } else {
                this.gameStatus = 'stalemate';
            }
        } else if (this.inCheck) {
            this.gameStatus = 'check';
        } else {
            this.gameStatus = 'playing';
        }
    }
    
    updateGameInfo() {
        document.getElementById('current-player').textContent = 
            this.currentPlayer.charAt(0).toUpperCase() + this.currentPlayer.slice(1);
        
        let statusText = '';
        switch (this.gameStatus) {
            case 'playing':
                statusText = this.aiThinking ? 'AI Thinking...' : 'Playing';
                break;
            case 'check':
                statusText = 'Check!';
                break;
            case 'checkmate-white':
                statusText = 'Checkmate - White Wins!';
                break;
            case 'checkmate-black':
                statusText = 'Checkmate - Black Wins!';
                break;
            case 'stalemate':
                statusText = 'Stalemate - Draw!';
                break;
        }
        
        document.getElementById('game-status').textContent = statusText;
        document.getElementById('game-mode').textContent = 
            this.gameMode === 'ai' ? `Human vs AI (${this.aiColor})` : 'Human vs Human';
        
        if (this.gameMode === 'ai') {
            document.getElementById('ai-info').style.display = 'block';
            document.getElementById('ai-difficulty-display').textContent = this.aiDifficulty;
        } else {
            document.getElementById('ai-info').style.display = 'none';
        }
        
        if (this.inCheck) {
            const kingPos = this.findKing(this.currentPlayer);
            const kingSquare = document.querySelector(`[data-row="${kingPos.row}"][data-col="${kingPos.col}"]`);
            kingSquare.classList.add('check-indicator');
        }
        
        this.renderCapturedPieces();
    }
    
    renderCapturedPieces() {
        const whiteCaptured = document.getElementById('captured-white-pieces');
        const blackCaptured = document.getElementById('captured-black-pieces');
        
        whiteCaptured.innerHTML = '';
        blackCaptured.innerHTML = '';
        
        this.capturedPieces.white.forEach(pieceType => {
            const piece = document.createElement('span');
            piece.className = 'captured-piece';
            piece.textContent = this.pieceSymbols.white[pieceType];
            whiteCaptured.appendChild(piece);
        });
        
        this.capturedPieces.black.forEach(pieceType => {
            const piece = document.createElement('span');
            piece.className = 'captured-piece';
            piece.textContent = this.pieceSymbols.black[pieceType];
            blackCaptured.appendChild(piece);
        });
    }
    
    // AI Methods
    showAISetupModal() {
        document.getElementById('ai-setup-modal').style.display = 'flex';
    }
    
    hideAISetupModal() {
        document.getElementById('ai-setup-modal').style.display = 'none';
    }
    
    startAIGame() {
        const aiColor = document.getElementById('ai-color').value;
        const difficulty = parseInt(document.getElementById('ai-difficulty').value);
        
        this.gameMode = 'ai';
        this.aiDifficulty = difficulty;
        
        // Determine AI color
        if (aiColor === 'random') {
            this.aiColor = Math.random() < 0.5 ? 'white' : 'black';
        } else {
            this.aiColor = aiColor;
        }
        
        this.newGame();
        this.hideAISetupModal();
        
        // If AI plays white, make the first move
        if (this.aiColor === 'white') {
            this.makeAIMove();
        }
    }
    
    async makeAIMove() {
        if (this.aiThinking) return;
        
        this.aiThinking = true;
        document.getElementById('ai-status').style.display = 'block';
        this.updateGameInfo();
        
        try {
            const fen = this.boardToFEN();
            
            const response = await fetch('/api/ai-move', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    fen: fen,
                    difficulty: this.aiDifficulty
                })
            });
            
            const data = await response.json();
            
            if (data.move) {
                this.executeAIMove(data.move);
            } else {
                console.error('No move received from AI:', data);
            }
        } catch (error) {
            console.error('Error getting AI move:', error);
        } finally {
            this.aiThinking = false;
            document.getElementById('ai-status').style.display = 'none';
            this.updateGameInfo();
        }
    }
    
    executeAIMove(moveStr) {
        const fromCol = moveStr.charCodeAt(0) - 97; // 'a' = 97
        const fromRow = 8 - parseInt(moveStr[1]);
        const toCol = moveStr.charCodeAt(2) - 97;
        const toRow = 8 - parseInt(moveStr[3]);
        
        if (this.isValidMove(fromRow, fromCol, toRow, toCol)) {
            setTimeout(() => {
                this.makeMove(fromRow, fromCol, toRow, toCol);
            }, 500); // Small delay to make AI move visible
        }
    }
    
    boardToFEN() {
        let fen = '';
        
        // Board position
        for (let row = 0; row < 8; row++) {
            let emptyCount = 0;
            for (let col = 0; col < 8; col++) {
                const piece = this.board[row][col];
                if (piece === null) {
                    emptyCount++;
                } else {
                    if (emptyCount > 0) {
                        fen += emptyCount;
                        emptyCount = 0;
                    }
                    
                    let pieceChar = piece.type === 'knight' ? 'n' : piece.type[0];
                    if (piece.color === 'white') {
                        pieceChar = pieceChar.toUpperCase();
                    }
                    fen += pieceChar;
                }
            }
            
            if (emptyCount > 0) {
                fen += emptyCount;
            }
            
            if (row < 7) {
                fen += '/';
            }
        }
        
        // Active color
        fen += this.currentPlayer === 'white' ? ' w ' : ' b ';
        
        // Castling rights
        let castling = '';
        if (this.castlingRights.white.kingside) castling += 'K';
        if (this.castlingRights.white.queenside) castling += 'Q';
        if (this.castlingRights.black.kingside) castling += 'k';
        if (this.castlingRights.black.queenside) castling += 'q';
        fen += (castling || '-') + ' ';
        
        // En passant (simplified for now)
        fen += '- ';
        
        // Halfmove and fullmove clocks
        fen += '0 1';
        
        return fen;
    }
    
    undoMove() {
        if (this.moveHistory.length === 0) return;
        
        const lastMove = this.moveHistory.pop();
        
        // Handle castling undo
        if (lastMove.castling) {
            // Undo king move
            this.board[lastMove.fromRow][lastMove.fromCol] = { ...lastMove.piece };
            this.board[lastMove.toRow][lastMove.toCol] = null;
            
            // Undo rook move
            if (lastMove.castling === 'kingside') {
                const rook = this.board[lastMove.fromRow][5];
                this.board[lastMove.fromRow][7] = rook;
                this.board[lastMove.fromRow][5] = null;
            } else { // queenside
                const rook = this.board[lastMove.fromRow][3];
                this.board[lastMove.fromRow][0] = rook;
                this.board[lastMove.fromRow][3] = null;
            }
        } else {
            // Regular move undo
            this.board[lastMove.fromRow][lastMove.fromCol] = { ...lastMove.piece };
            
            if (lastMove.capturedPiece) {
                this.board[lastMove.toRow][lastMove.toCol] = { ...lastMove.capturedPiece };
                const capturedArray = this.capturedPieces[lastMove.capturedPiece.color];
                const index = capturedArray.lastIndexOf(lastMove.capturedPiece.type);
                if (index > -1) {
                    capturedArray.splice(index, 1);
                }
            } else {
                this.board[lastMove.toRow][lastMove.toCol] = null;
            }
        }
        
        // Restore castling rights
        if (lastMove.castlingRights) {
            this.castlingRights = lastMove.castlingRights;
        }
        
        this.currentPlayer = this.currentPlayer === 'white' ? 'black' : 'white';
        this.lastMove = this.moveHistory.length > 0 ? this.moveHistory[this.moveHistory.length - 1] : null;
        
        this.updateGameStatus();
        this.renderBoard();
    }
    
    newGame() {
        this.board = [];
        this.currentPlayer = 'white';
        this.selectedSquare = null;
        this.gameStatus = 'playing';
        this.moveHistory = [];
        this.capturedPieces = { white: [], black: [] };
        this.inCheck = false;
        this.lastMove = null;
        this.aiThinking = false;
        
        // Reset castling rights
        this.castlingRights = {
            white: { kingside: true, queenside: true },
            black: { kingside: true, queenside: true }
        };
        
        // Reset to PvP mode unless explicitly starting AI game
        if (this.gameMode !== 'ai') {
            this.gameMode = 'pvp';
            this.aiColor = '';
        }
        
        document.getElementById('ai-status').style.display = 'none';
        
        this.initializeBoard();
        this.renderBoard();
    }
}

// Initialize the game when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new ChessGame();
});