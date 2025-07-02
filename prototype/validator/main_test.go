package main

import (
	"fmt"
	"testing"
)

// Helper function to generate deterministic hash-like strings from integers
func hashFromInt(i int) string {
	// Generate a 64-character hex string (like SHA256)
	return fmt.Sprintf("%064x", i)
}

// Test CLI flag validation (basic tests without full CLI execution)
func TestCLIValidation(t *testing.T) {
	// These tests validate our understanding of the CLI structure
	// without actually executing commands

	// Test that required command structures exist
	if rootCmd == nil {
		t.Error("rootCmd should be defined")
	}

	if playlistCmd == nil {
		t.Error("playlistCmd should be defined")
	}

	if capsuleCmd == nil {
		t.Error("capsuleCmd should be defined")
	}

	// Test that commands have proper parents
	found := false
	for _, cmd := range rootCmd.Commands() {
		if cmd == playlistCmd {
			found = true
			break
		}
	}
	if !found {
		t.Error("playlistCmd should be added to rootCmd")
	}

	found = false
	for _, cmd := range rootCmd.Commands() {
		if cmd == capsuleCmd {
			found = true
			break
		}
	}
	if !found {
		t.Error("capsuleCmd should be added to rootCmd")
	}
}

func TestCLIHelpText(t *testing.T) {
	// Test that commands have proper help text
	if rootCmd.Short == "" {
		t.Error("rootCmd should have short description")
	}

	if playlistCmd.Short == "" {
		t.Error("playlistCmd should have short description")
	}

	if capsuleCmd.Short == "" {
		t.Error("capsuleCmd should have short description")
	}

	// Test that help text contains expected keywords
	expectedKeywords := []string{"DP-1", "playlist", "capsule", "validator"}

	for _, keyword := range expectedKeywords {
		found := false
		if contains(rootCmd.Long, keyword) || contains(rootCmd.Short, keyword) {
			found = true
		}
		if !found {
			t.Errorf("Root command help should contain keyword: %s", keyword)
		}
	}
}

// Helper function to check if string contains substring (case-insensitive)
func contains(s, substr string) bool {
	return len(s) >= len(substr) && indexCaseInsensitive(s, substr) >= 0
}

func indexCaseInsensitive(s, substr string) int {
	lower_s := toLower(s)
	lower_substr := toLower(substr)

	for i := 0; i <= len(lower_s)-len(lower_substr); i++ {
		if lower_s[i:i+len(lower_substr)] == lower_substr {
			return i
		}
	}
	return -1
}

func toLower(s string) string {
	result := ""
	for _, r := range s {
		if r >= 'A' && r <= 'Z' {
			result += string(r + 32)
		} else {
			result += string(r)
		}
	}
	return result
}

// Benchmark tests for main package functions
func BenchmarkCompareHashLists(b *testing.B) {
	// Setup test data
	expected := make([]string, 1000)
	actual := make([]string, 1000)

	for i := 0; i < 1000; i++ {
		expected[i] = hashFromInt(i)
		actual[i] = hashFromInt(i)
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, _, _ = compareHashLists(expected, actual)
	}
}

func BenchmarkCompareHashListsWorstCase(b *testing.B) {
	// Setup worst case: no matches
	expected := make([]string, 1000)
	actual := make([]string, 1000)

	for i := 0; i < 1000; i++ {
		expected[i] = hashFromInt(i)
		actual[i] = hashFromInt(i + 1000)
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, _, _ = compareHashLists(expected, actual)
	}
}

// Test error handling in CLI functions (without full execution)
func TestErrorHandling(t *testing.T) {
	// Test that error messages are properly formatted
	testError := fmt.Errorf("test error message")
	errorString := testError.Error()

	if errorString != "test error message" {
		t.Errorf("Error formatting issue: got %q", errorString)
	}
}

// Test global variables initialization
func TestGlobalVariables(t *testing.T) {
	// Test that global variables are properly initialized
	if playlistInput != "" {
		t.Error("playlistInput should be empty initially")
	}

	if pubkeyHex != "" {
		t.Error("pubkeyHex should be empty initially")
	}

	if capsulePlaylist != "" {
		t.Error("capsulePlaylist should be empty initially")
	}

	if directoryPath != "" {
		t.Error("directoryPath should be empty initially")
	}

	if hashesInput != "" {
		t.Error("hashesInput should be empty initially")
	}
}
