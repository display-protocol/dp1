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

	if capsulePath != "" {
		t.Error("capsulePath should be empty initially")
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
	pathFlag := capsuleCmd.Flags().Lookup("path")
	//nolint:staticcheck // SA5011(related information): t.Error will panic
	if pathFlag == nil {
		t.Error("capsule command should have --path flag")
	}

	hashesFlag := capsuleCmd.Flags().Lookup("hashes")
	//nolint:staticcheck // SA5011(related information): t.Error will panic
	if hashesFlag == nil {
		t.Error("capsule command should have --hashes flag")
	}

	// Check that path is required
	//nolint:staticcheck // SA5011(related information): t.Error will panic
	pathAnnotations := pathFlag.Annotations
	if pathAnnotations == nil || pathAnnotations[cobra.BashCompOneRequiredFlag] == nil {
		t.Error("path flag should be required for capsule command")
	}

	// Check that hashes is optional
	//nolint:staticcheck // SA5011(related information): t.Error will panic
	hashesAnnotations := hashesFlag.Annotations
	if hashesAnnotations != nil && hashesAnnotations[cobra.BashCompOneRequiredFlag] != nil {
		t.Error("hashes flag should be optional for capsule command")
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
			errorMsg:    "required flag(s) \"path\" not set",
		},
		{
			name:        "Only path provided",
			args:        []string{"capsule", "--path", "test.dp1c"},
			shouldError: false, // Will error later due to file not existing, but flag validation passes
		},
		{
			name:        "Path with hashes provided",
			args:        []string{"capsule", "--path", "test.dp1c", "--hashes", "abc123,def456"},
			shouldError: false, // Will error later due to file not existing, but flag validation passes
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Reset flags
			capsulePath = ""
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
				// For cases that shouldn't error in flag validation, they might still error
				// due to invalid file paths, but we're just testing the flag validation
				if err != nil && strings.Contains(err.Error(), "required flag(s)") {
					t.Errorf("Unexpected flag validation error: %v", err)
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
		"Capsule only:",
		"Capsule with override:",
	}

	for _, mode := range expectedModes {
		if !strings.Contains(helpText, mode) {
			t.Errorf("Help text should contain usage mode: %s", mode)
		}
	}

	// Test that the help mentions important requirements
	expectedContent := []string{
		".dp1c file",
		"tar+zstd",
		"playlist.json",
		"assets/",
		"provided hashes override",
	}

	for _, content := range expectedContent {
		if !strings.Contains(helpText, content) {
			t.Errorf("Help text should contain: %s", content)
		}
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
