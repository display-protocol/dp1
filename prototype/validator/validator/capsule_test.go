package validator

import (
	"archive/tar"
	"encoding/json"
	"io"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/klauspost/compress/zstd"
)

// createTestCapsule creates a test .dp1c file with the given content
func createTestCapsule(t *testing.T, playlistData map[string]interface{}, assets map[string]string) string {
	t.Helper()

	// Create temporary directory
	tempDir, err := os.MkdirTemp("", "test-capsule-*")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	t.Cleanup(func() { _ = os.RemoveAll(tempDir) })

	// Create capsule content directory
	capsuleDir := filepath.Join(tempDir, "capsule")
	if err := os.MkdirAll(capsuleDir, 0750); err != nil {
		t.Fatalf("Failed to create capsule dir: %v", err)
	}

	// Write playlist.json
	playlistJSON, err := json.MarshalIndent(playlistData, "", "  ")
	if err != nil {
		t.Fatalf("Failed to marshal playlist: %v", err)
	}
	if err := os.WriteFile(filepath.Join(capsuleDir, "playlist.json"), playlistJSON, 0600); err != nil {
		t.Fatalf("Failed to write playlist.json: %v", err)
	}

	// Create assets directory (now required)
	assetsDir := filepath.Join(capsuleDir, "assets")
	if err := os.MkdirAll(assetsDir, 0750); err != nil {
		t.Fatalf("Failed to create assets dir: %v", err)
	}

	// Write asset files
	for filename, content := range assets {
		if err := os.WriteFile(filepath.Join(assetsDir, filename), []byte(content), 0600); err != nil {
			t.Fatalf("Failed to write asset %s: %v", filename, err)
		}
	}

	// Create .dp1c archive
	capsulePath := filepath.Join(tempDir, "test.dp1c")
	if err := createTarZstdArchive(capsuleDir, capsulePath); err != nil {
		t.Fatalf("Failed to create .dp1c archive: %v", err)
	}

	return capsulePath
}

// createTarZstdArchive creates a tar+zstd archive from a directory
func createTarZstdArchive(sourceDir, archivePath string) error {
	// Create archive file
	//nolint:gosec // G304: Ignore for testing
	file, err := os.Create(archivePath)
	if err != nil {
		return err
	}
	defer func() { _ = file.Close() }()

	// Create zstd encoder
	encoder, err := zstd.NewWriter(file)
	if err != nil {
		return err
	}
	defer func() { _ = encoder.Close() }()

	// Create tar writer
	tarWriter := tar.NewWriter(encoder)
	defer func() { _ = tarWriter.Close() }()

	// Walk the source directory
	return filepath.Walk(sourceDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		// Get relative path
		relPath, err := filepath.Rel(sourceDir, path)
		if err != nil {
			return err
		}

		// Skip the root directory itself
		if relPath == "." {
			return nil
		}

		// Create tar header
		header, err := tar.FileInfoHeader(info, "")
		if err != nil {
			return err
		}
		header.Name = relPath

		// Write header
		if err := tarWriter.WriteHeader(header); err != nil {
			return err
		}

		// Write file content if it's a regular file
		if info.Mode().IsRegular() {
			//nolint:gosec // G304: Ignore for testing
			file, err := os.Open(path)
			if err != nil {
				return err
			}
			defer func() { _ = file.Close() }()

			_, err = io.Copy(tarWriter, file)
			return err
		}

		return nil
	})
}

func TestExtractCapsule(t *testing.T) {
	// Valid playlist for testing (using proper UUIDs from playlist package)
	validPlaylist := map[string]any{
		"dpVersion": "1.0.0",
		"id":        "385f79b6-a45f-4c1c-8080-e93a192adccc", // Use valid UUID
		"created":   "2025-01-01T00:00:00Z",
		"title":     "Test Playlist",
		"items": []any{
			map[string]any{
				"id":     "285f79b6-a45f-4c1c-8080-e93a192adccc", // Use valid UUID
				"source": "https://example.com/test.html",
				"repro": map[string]any{
					"assetsSHA256": []any{
						"abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
						"fedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321",
					},
				},
			},
		},
	}

	assets := map[string]string{
		"test1.txt": "Hello World",
		"test2.txt": "Test Content",
	}

	tests := []struct {
		name        string
		setupFile   func(t *testing.T) string
		expectError bool
		errorMsg    string
	}{
		{
			name: "Valid capsule",
			setupFile: func(t *testing.T) string {
				return createTestCapsule(t, validPlaylist, assets)
			},
			expectError: false,
		},
		{
			name: "Invalid file extension",
			setupFile: func(t *testing.T) string {
				capsulePath := createTestCapsule(t, validPlaylist, assets)
				// Rename to invalid extension
				invalidPath := strings.TrimSuffix(capsulePath, ".dp1c") + ".zip"
				_ = os.Rename(capsulePath, invalidPath)
				return invalidPath
			},
			expectError: true,
			errorMsg:    "file must have .dp1c extension",
		},
		{
			name: "Non-existent file",
			setupFile: func(t *testing.T) string {
				return "/nonexistent/path/test.dp1c"
			},
			expectError: true,
			errorMsg:    "cannot access capsule file",
		},
		{
			name: "Missing assets directory",
			setupFile: func(t *testing.T) string {
				// Create a capsule without assets directory
				tempDir, err := os.MkdirTemp("", "test-no-assets-*")
				if err != nil {
					t.Fatalf("Failed to create temp dir: %v", err)
				}
				t.Cleanup(func() { _ = os.RemoveAll(tempDir) })

				// Create capsule content directory
				capsuleDir := filepath.Join(tempDir, "capsule")
				if err := os.MkdirAll(capsuleDir, 0750); err != nil {
					t.Fatalf("Failed to create capsule dir: %v", err)
				}

				// Write only playlist.json (no assets directory)
				playlistJSON, err := json.MarshalIndent(validPlaylist, "", "  ")
				if err != nil {
					t.Fatalf("Failed to marshal playlist: %v", err)
				}
				if err := os.WriteFile(filepath.Join(capsuleDir, "playlist.json"), playlistJSON, 0600); err != nil {
					t.Fatalf("Failed to write playlist.json: %v", err)
				}

				// Create .dp1c archive without assets
				capsulePath := filepath.Join(tempDir, "test.dp1c")
				if err := createTarZstdArchive(capsuleDir, capsulePath); err != nil {
					t.Fatalf("Failed to create .dp1c archive: %v", err)
				}

				return capsulePath
			},
			expectError: true,
			errorMsg:    "assets/ directory not found in capsule root - it is required",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			capsulePath := tt.setupFile(t)

			info, err := ExtractCapsule(capsulePath)

			if tt.expectError {
				if err == nil {
					t.Errorf("Expected error but got none")
				} else if !strings.Contains(err.Error(), tt.errorMsg) {
					t.Errorf("Expected error containing %q, got %q", tt.errorMsg, err.Error())
				}
				return
			}

			if err != nil {
				t.Errorf("Unexpected error: %v", err)
				return
			}

			if info == nil {
				t.Error("Expected CapsuleInfo but got nil")
				return
			}

			// Verify extraction
			if info.ExtractPath == "" {
				t.Error("ExtractPath should not be empty")
			}

			if info.PlaylistPath == "" {
				t.Error("PlaylistPath should not be empty")
			}

			if info.Playlist == nil {
				t.Error("Playlist should not be nil")
			}

			// Verify playlist content
			if info.Playlist.DPVersion != "1.0.0" {
				t.Errorf("Expected dpVersion 1.0.0, got %v", info.Playlist.DPVersion)
			}

			// Cleanup
			_ = CleanupCapsule(info)
		})
	}
}

func TestCleanupCapsule(t *testing.T) {
	// Test cleanup with valid info
	tempDir, err := os.MkdirTemp("", "test-cleanup-*")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}

	info := &CapsuleInfo{
		ExtractPath: tempDir,
	}

	// Verify directory exists
	if _, err := os.Stat(tempDir); err != nil {
		t.Fatalf("Temp dir should exist: %v", err)
	}

	// Cleanup
	err = CleanupCapsule(info)
	if err != nil {
		t.Errorf("Cleanup failed: %v", err)
	}

	// Verify directory is removed
	if _, err := os.Stat(tempDir); !os.IsNotExist(err) {
		t.Error("Temp dir should be removed after cleanup")
	}

	// Test cleanup with nil info
	err = CleanupCapsule(nil)
	if err != nil {
		t.Errorf("Cleanup with nil info should not error: %v", err)
	}
}
