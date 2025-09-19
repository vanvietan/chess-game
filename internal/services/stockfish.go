package services

import (
	"bufio"
	"context"
	"fmt"
	"os/exec"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/vanvietannguyen/chess-game/internal/models"
)

type StockfishService struct {
	cmd    *exec.Cmd
	stdin  *bufio.Writer
	stdout *bufio.Scanner
	mutex  sync.Mutex
	ready  bool
}

func NewStockfishService(stockfishPath string) *StockfishService {
	sf := &StockfishService{}
	sf.initialize(stockfishPath)
	return sf
}

func (sf *StockfishService) initialize(stockfishPath string) error {
	sf.mutex.Lock()
	defer sf.mutex.Unlock()

	// Start Stockfish process
	sf.cmd = exec.Command(stockfishPath)

	// Set up pipes
	stdin, err := sf.cmd.StdinPipe()
	if err != nil {
		return fmt.Errorf("failed to create stdin pipe: %w", err)
	}

	stdout, err := sf.cmd.StdoutPipe()
	if err != nil {
		return fmt.Errorf("failed to create stdout pipe: %w", err)
	}

	// Start the process
	if err := sf.cmd.Start(); err != nil {
		return fmt.Errorf("failed to start stockfish: %w", err)
	}

	sf.stdin = bufio.NewWriter(stdin)
	sf.stdout = bufio.NewScanner(stdout)

	// Initialize UCI protocol
	sf.sendCommand("uci")
	sf.waitForResponse("uciok")

	sf.sendCommand("isready")
	sf.waitForResponse("readyok")

	sf.ready = true
	return nil
}

func (sf *StockfishService) sendCommand(command string) error {
	_, err := sf.stdin.WriteString(command + "\n")
	if err != nil {
		return err
	}
	return sf.stdin.Flush()
}

func (sf *StockfishService) waitForResponse(expected string) error {
	for sf.stdout.Scan() {
		line := sf.stdout.Text()
		if strings.Contains(line, expected) {
			return nil
		}
	}
	return fmt.Errorf("timeout waiting for response: %s", expected)
}

func (sf *StockfishService) GetBestMove(ctx context.Context, fen string, settings *models.AISettings) (*models.AIMoveResponse, error) {
	sf.mutex.Lock()
	defer sf.mutex.Unlock()

	if !sf.ready {
		return nil, fmt.Errorf("stockfish not ready")
	}

	// Set skill level (0-20)
	difficulty := 10
	if settings != nil && settings.Difficulty > 0 {
		difficulty = settings.Difficulty
		if difficulty > 20 {
			difficulty = 20
		}
	}

	sf.sendCommand(fmt.Sprintf("setoption name Skill Level value %d", difficulty))

	// Set position
	sf.sendCommand(fmt.Sprintf("position fen %s", fen))

	// Calculate search parameters
	timeLimit := 1000 // default 1 second
	if settings != nil && settings.TimeLimit > 0 {
		timeLimit = settings.TimeLimit
	}

	depth := 12
	if settings != nil && settings.MaxDepth > 0 {
		depth = settings.MaxDepth
	}

	// Start search
	searchCmd := fmt.Sprintf("go movetime %d depth %d", timeLimit, depth)
	sf.sendCommand(searchCmd)

	// Wait for best move with timeout
	ctx, cancel := context.WithTimeout(ctx, time.Duration(timeLimit+2000)*time.Millisecond)
	defer cancel()

	var bestMove string
	var evaluation float64
	var searchDepth int

	done := make(chan bool)
	go func() {
		defer close(done)

		for sf.stdout.Scan() {
			line := sf.stdout.Text()

			// Parse evaluation info
			if strings.HasPrefix(line, "info") {
				if eval := sf.parseEvaluation(line); eval != nil {
					evaluation = *eval
				}
				if d := sf.parseDepth(line); d != nil {
					searchDepth = *d
				}
			}

			// Parse best move
			if strings.HasPrefix(line, "bestmove") {
				parts := strings.Fields(line)
				if len(parts) >= 2 {
					bestMove = parts[1]
					done <- true
					return
				}
			}
		}
	}()

	select {
	case <-ctx.Done():
		return nil, fmt.Errorf("timeout waiting for stockfish response")
	case <-done:
		if bestMove == "" {
			return nil, fmt.Errorf("no best move found")
		}
	}

	// Parse move
	if len(bestMove) < 4 {
		return nil, fmt.Errorf("invalid move format: %s", bestMove)
	}

	response := &models.AIMoveResponse{
		Success:    true,
		Move:       bestMove,
		From:       bestMove[:2],
		To:         bestMove[2:4],
		Evaluation: evaluation,
		Depth:      searchDepth,
	}

	// Check for promotion
	if len(bestMove) == 5 {
		response.Promotion = string(bestMove[4])
	}

	return response, nil
}

func (sf *StockfishService) AnalyzePosition(ctx context.Context, fen string, depth int) (*PositionAnalysis, error) {
	sf.mutex.Lock()
	defer sf.mutex.Unlock()

	if !sf.ready {
		return nil, fmt.Errorf("stockfish not ready")
	}

	sf.sendCommand(fmt.Sprintf("position fen %s", fen))
	sf.sendCommand(fmt.Sprintf("go depth %d", depth))

	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	analysis := &PositionAnalysis{
		Depth: depth,
	}

	done := make(chan bool)
	go func() {
		defer close(done)

		for sf.stdout.Scan() {
			line := sf.stdout.Text()

			if strings.HasPrefix(line, "info") {
				if eval := sf.parseEvaluation(line); eval != nil {
					analysis.Evaluation = *eval
				}
				if mate := sf.parseMate(line); mate != nil {
					analysis.Mate = mate
				}
				if nodes := sf.parseNodes(line); nodes != nil {
					analysis.NodesSearched = *nodes
				}
				if time := sf.parseTime(line); time != nil {
					analysis.Time = *time
				}
				if pv := sf.parsePV(line); len(pv) > 0 {
					analysis.PrincipalVariation = pv
					if len(pv) > 0 {
						analysis.BestMove = pv[0]
					}
				}
			}

			if strings.HasPrefix(line, "bestmove") {
				parts := strings.Fields(line)
				if len(parts) >= 2 {
					analysis.BestMove = parts[1]
					done <- true
					return
				}
			}
		}
	}()

	select {
	case <-ctx.Done():
		return nil, fmt.Errorf("timeout analyzing position")
	case <-done:
		return analysis, nil
	}
}

func (sf *StockfishService) parseEvaluation(line string) *float64 {
	re := regexp.MustCompile(`score cp (-?\d+)`)
	matches := re.FindStringSubmatch(line)
	if len(matches) == 2 {
		if eval, err := strconv.ParseFloat(matches[1], 64); err == nil {
			result := eval / 100.0 // Convert centipawns to pawns
			return &result
		}
	}
	return nil
}

func (sf *StockfishService) parseMate(line string) *int {
	re := regexp.MustCompile(`score mate (-?\d+)`)
	matches := re.FindStringSubmatch(line)
	if len(matches) == 2 {
		if mate, err := strconv.Atoi(matches[1]); err == nil {
			return &mate
		}
	}
	return nil
}

func (sf *StockfishService) parseDepth(line string) *int {
	re := regexp.MustCompile(`depth (\d+)`)
	matches := re.FindStringSubmatch(line)
	if len(matches) == 2 {
		if depth, err := strconv.Atoi(matches[1]); err == nil {
			return &depth
		}
	}
	return nil
}

func (sf *StockfishService) parseNodes(line string) *int64 {
	re := regexp.MustCompile(`nodes (\d+)`)
	matches := re.FindStringSubmatch(line)
	if len(matches) == 2 {
		if nodes, err := strconv.ParseInt(matches[1], 10, 64); err == nil {
			return &nodes
		}
	}
	return nil
}

func (sf *StockfishService) parseTime(line string) *int {
	re := regexp.MustCompile(`time (\d+)`)
	matches := re.FindStringSubmatch(line)
	if len(matches) == 2 {
		if time, err := strconv.Atoi(matches[1]); err == nil {
			return &time
		}
	}
	return nil
}

func (sf *StockfishService) parsePV(line string) []string {
	re := regexp.MustCompile(`pv (.+)`)
	matches := re.FindStringSubmatch(line)
	if len(matches) == 2 {
		return strings.Fields(matches[1])
	}
	return nil
}

func (sf *StockfishService) Close() error {
	sf.mutex.Lock()
	defer sf.mutex.Unlock()

	if sf.cmd != nil && sf.cmd.Process != nil {
		sf.sendCommand("quit")
		return sf.cmd.Process.Kill()
	}
	return nil
}
