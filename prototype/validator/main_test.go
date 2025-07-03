package main

import (
	"slices"
	"strings"
	"testing"

	"github.com/spf13/cobra"
)

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
	if !slices.Contains(rootCmd.Commands(), playlistCmd) {
		t.Error("playlistCmd should be added to rootCmd")
	}

	if !slices.Contains(rootCmd.Commands(), capsuleCmd) {
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

	const expectedShort = "DP-1 playlist and capsule validator"
	if rootCmd.Short != expectedShort {
		t.Errorf("rootCmd should have short description: %s", rootCmd.Short)
	}

	const expectedLong = `A validator for DP-1 playlists and capsules that can verify:
- Ed25519 signatures on playlists
- SHA256 asset integrity in capsules
- Structural compliance with DP-1 specification`
	if rootCmd.Long != expectedLong {
		t.Errorf("rootCmd should have long description: %s", rootCmd.Long)
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

func TestCLIStructure(t *testing.T) {
	// Test that root command exists
	if rootCmd == nil {
		t.Fatal("rootCmd should not be nil")
	}

	// Test that both subcommands exist
	commands := rootCmd.Commands()
	if len(commands) != 2 {
		t.Fatalf("Expected 2 subcommands, got %d", len(commands))
	}

	// Check command names
	cmdNames := make(map[string]bool)
	for _, cmd := range commands {
		cmdNames[cmd.Use] = true
	}

	if !cmdNames["playlist"] {
		t.Error("playlist command not found")
	}
	if !cmdNames["capsule"] {
		t.Error("capsule command not found")
	}
}

func TestPlaylistCommandFlags(t *testing.T) {
	// Test playlist command flags
	playlistFlag := playlistCmd.Flags().Lookup("playlist")
	if playlistFlag == nil {
		t.Error("playlist command should have --playlist flag")
	}

	pubkeyFlag := playlistCmd.Flags().Lookup("pubkey")
	if pubkeyFlag == nil {
		t.Error("playlist command should have --pubkey flag")
	}

	// Check that required flags are marked as required
	requiredFlags := []string{"playlist", "pubkey"}
	for _, flagName := range requiredFlags {
		annotations := playlistCmd.Flags().Lookup(flagName).Annotations
		if annotations == nil || annotations[cobra.BashCompOneRequiredFlag] == nil {
			t.Errorf("Flag %s should be required", flagName)
		}
	}
}

func TestCapsuleCommandFlags(t *testing.T) {
	// Test capsule command flags
	playlistFlag := capsuleCmd.Flags().Lookup("playlist")
	//nolint:staticcheck
	if playlistFlag == nil {
		t.Error("capsule command should have --playlist flag")
	}

	pathFlag := capsuleCmd.Flags().Lookup("path")
	if pathFlag == nil {
		t.Error("capsule command should have --path flag")
	}

	hashesFlag := capsuleCmd.Flags().Lookup("hashes")
	if hashesFlag == nil {
		t.Error("capsule command should have --hashes flag")
	}

	// Check that playlist is NOT required (should be optional now)
	//nolint:staticcheck
	playlistAnnotations := playlistFlag.Annotations
	if playlistAnnotations != nil && playlistAnnotations[cobra.BashCompOneRequiredFlag] != nil {
		t.Error("playlist flag should be optional for capsule command")
	}
}

func TestCapsuleCommandValidation(t *testing.T) {
	tests := []struct {
		name        string
		args        []string
		shouldError bool
		errorMsg    string
	}{
		{
			name:        "No flags provided",
			args:        []string{"capsule"},
			shouldError: true,
			errorMsg:    "either --playlist or --path must be provided",
		},
		{
			name:        "Only playlist provided",
			args:        []string{"capsule", "--playlist", "test"},
			shouldError: false,
		},
		{
			name:        "Only path provided without hashes",
			args:        []string{"capsule", "--path", "/tmp"},
			shouldError: true,
			errorMsg:    "--hashes must be provided when using --path without a playlist",
		},
		{
			name:        "Path with hashes provided",
			args:        []string{"capsule", "--path", "/tmp", "--hashes", "abc123,def456"},
			shouldError: false,
		},
		{
			name:        "Both playlist and path provided",
			args:        []string{"capsule", "--playlist", "test", "--path", "/tmp"},
			shouldError: false,
		},
		{
			name:        "All flags provided",
			args:        []string{"capsule", "--playlist", "test", "--path", "/tmp", "--hashes", "abc123,def456"},
			shouldError: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Reset flags
			capsulePlaylist = ""
			directoryPath = ""
			hashesInput = ""

			// Set up command with args
			rootCmd.SetArgs(tt.args)

			// Execute command
			err := rootCmd.Execute()

			if tt.shouldError {
				if err == nil {
					t.Errorf("Expected error but got none")
				} else if !strings.Contains(err.Error(), tt.errorMsg) {
					t.Errorf("Expected error containing %q, got %q", tt.errorMsg, err.Error())
				}
			} else {
				// For cases that shouldn't error in validation, they might still error
				// due to invalid playlist content, but we're just testing the flag validation
				if err != nil && strings.Contains(err.Error(), "either --playlist or --path must be provided") {
					t.Errorf("Unexpected validation error: %v", err)
				}
				if err != nil && strings.Contains(err.Error(), "--hashes must be provided when using --path without a playlist") {
					t.Errorf("Unexpected validation error: %v", err)
				}
			}

			// Reset args for next test
			rootCmd.SetArgs([]string{})
		})
	}
}

func TestCapsuleUsageModes(t *testing.T) {
	// Test that the command help text includes information about usage modes
	helpText := capsuleCmd.Long

	expectedModes := []string{
		"Playlist only:",
		"Directory + Playlist:",
		"Directory + Hashes:",
		"Directory + Both:",
		"Hash comparison:",
	}

	for _, mode := range expectedModes {
		if !strings.Contains(helpText, mode) {
			t.Errorf("Help text should contain usage mode: %s", mode)
		}
	}

	// Test that the help mentions hash override behavior
	if !strings.Contains(helpText, "hashes override playlist hashes") {
		t.Error("Help text should mention hash override functionality")
	}
}

func TestSafeHashPreview(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{
			name:     "Short hash",
			input:    "abc123",
			expected: "abc123",
		},
		{
			name:     "Exactly 16 chars",
			input:    "0123456789abcdef",
			expected: "0123456789abcdef",
		},
		{
			name:     "Long hash",
			input:    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
			expected: "0123456789abcdef...",
		},
		{
			name:     "Empty string",
			input:    "",
			expected: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := safeHashPreview(tt.input)
			if result != tt.expected {
				t.Errorf("safeHashPreview(%q) = %q, want %q", tt.input, result, tt.expected)
			}
		})
	}
}
