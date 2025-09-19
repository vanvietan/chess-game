package config

import (
	"os"
)

type Config struct {
	Port          string
	StockfishPath string
	UseChessAPI   bool
	ChessAPIURL   string
}

func Load() *Config {
	config := &Config{
		Port:          getEnv("PORT", "8080"),
		StockfishPath: getEnv("STOCKFISH_PATH", "/usr/local/bin/stockfish"),
		UseChessAPI:   getEnv("USE_CHESS_API", "true") == "true", // Default to Chess-API.com
		ChessAPIURL:   getEnv("CHESS_API_URL", "https://chess-api.com/v1"),
	}

	return config
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
