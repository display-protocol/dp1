package validator

import (
	"crypto/sha256"
	"encoding/base64"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
)

func createTempDir(t *testing.T) string {
	dir, err := os.MkdirTemp("", "dp1-validator-test")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	return dir
}

func createTestFile(t *testing.T, path, content string) {
	if err := os.MkdirAll(filepath.Dir(path), 0750); err != nil {
		t.Fatalf("Failed to create directories: %v", err)
	}

	if err := os.WriteFile(path, []byte(content), 0600); err != nil {
		t.Fatalf("Failed to write test file %s: %v", path, err)
	}
}

func TestComputeDirectoryHashes(t *testing.T) {
	tempDir := createTempDir(t)
	defer func() {
		_ = os.RemoveAll(tempDir)
	}()

	// Create test files
	createTestFile(t, filepath.Join(tempDir, "file1.txt"), "hello")
	createTestFile(t, filepath.Join(tempDir, "file2.txt"), "world")
	createTestFile(t, filepath.Join(tempDir, "subdir", "file3.txt"), "test")

	results, err := ComputeDirectoryHashes(tempDir)
	if err != nil {
		t.Errorf("Unexpected error: %v", err)
		return
	}

	// Should have exactly 3 files
	if len(results) != 3 {
		t.Errorf("Expected 3 files, got %d", len(results))
	}

	// Check that results are sorted by path
	for i := 1; i < len(results); i++ {
		if results[i-1].Path > results[i].Path {
			t.Errorf("Results are not sorted by path")
			break
		}
	}

	// Check specific file hashes
	for _, result := range results {
		if result.Error != "" {
			t.Errorf("Unexpected error for file %s: %s", result.Path, result.Error)
			continue
		}

		switch result.Path {
		case "file1.txt":
			expectedHash := HashString("hello")
			if result.SHA256 != expectedHash {
				t.Errorf("Wrong hash for file1.txt: expected %s, got %s", expectedHash, result.SHA256)
			}
		case "file2.txt":
			expectedHash := HashString("world")
			if result.SHA256 != expectedHash {
				t.Errorf("Wrong hash for file2.txt: expected %s, got %s", expectedHash, result.SHA256)
			}
		case filepath.Join("subdir", "file3.txt"):
			expectedHash := HashString("test")
			if result.SHA256 != expectedHash {
				t.Errorf("Wrong hash for subdir/file3.txt: expected %s, got %s", expectedHash, result.SHA256)
			}
		}
	}
}

func TestComputeDirectoryHashesErrors(t *testing.T) {
	tests := []struct {
		name        string
		path        string
		expectError bool
		errorMsg    string
	}{
		{
			name:        "Non-existent directory",
			path:        "/non/existent/path",
			expectError: true,
			errorMsg:    "failed to access directory",
		},
		{
			name:        "File instead of directory",
			path:        "/etc/passwd", // This exists on most Unix systems
			expectError: true,
			errorMsg:    "path is not a directory",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Skip file test on Windows
			if tt.name == "File instead of directory" && os.PathSeparator == '\\' {
				t.Skip("Skipping Unix-specific test on Windows")
			}

			_, err := ComputeDirectoryHashes(tt.path)

			if tt.expectError {
				if err == nil {
					t.Errorf("Expected error but got none")
					return
				}
				if !strings.Contains(err.Error(), tt.errorMsg) {
					t.Errorf("Expected error containing %q, got %q", tt.errorMsg, err.Error())
				}
			} else {
				if err != nil {
					t.Errorf("Unexpected error: %v", err)
				}
			}
		})
	}
}

func TestComputeDirectoryHashesEmptyDir(t *testing.T) {
	tempDir := createTempDir(t)
	defer func() {
		_ = os.RemoveAll(tempDir)
	}()

	results, err := ComputeDirectoryHashes(tempDir)
	if err != nil {
		t.Errorf("Unexpected error: %v", err)
		return
	}

	if len(results) != 0 {
		t.Errorf("Expected 0 files in empty directory, got %d", len(results))
	}
}

func TestVerifyDirectoryHashes(t *testing.T) {
	tempDir := createTempDir(t)
	defer func() {
		_ = os.RemoveAll(tempDir)
	}()

	// Create test files
	createTestFile(t, filepath.Join(tempDir, "file1.txt"), "hello")
	createTestFile(t, filepath.Join(tempDir, "file2.txt"), "world")

	expectedHashes := []string{
		HashString("hello"),
		HashString("world"),
	}

	result, err := VerifyDirectoryHashes(tempDir, expectedHashes)
	if err != nil {
		t.Errorf("Unexpected error: %v", err)
		return
	}

	if !result.Success {
		t.Errorf("Verification should have succeeded")
	}

	if result.TotalFiles != 2 {
		t.Errorf("Expected 2 total files, got %d", result.TotalFiles)
	}

	if result.MatchedHashes != 2 {
		t.Errorf("Expected 2 matched hashes, got %d", result.MatchedHashes)
	}

	if len(result.MissingHashes) != 0 {
		t.Errorf("Expected no missing hashes, got %v", result.MissingHashes)
	}

	if len(result.ExtraHashes) != 0 {
		t.Errorf("Expected no extra hashes, got %v", result.ExtraHashes)
	}
}

func TestVerifyDirectoryHashesMismatch(t *testing.T) {
	tempDir := createTempDir(t)
	defer func() {
		_ = os.RemoveAll(tempDir)
	}()

	// Create test files
	createTestFile(t, filepath.Join(tempDir, "file1.txt"), "hello")

	// Provide wrong expected hashes
	expectedHashes := []string{
		HashString("goodbye"), // Wrong hash
		HashString("missing"), // Missing file
	}

	result, err := VerifyDirectoryHashes(tempDir, expectedHashes)
	if err != nil {
		t.Errorf("Unexpected error: %v", err)
		return
	}

	if result.Success {
		t.Errorf("Verification should have failed")
	}

	if len(result.MissingHashes) != 2 {
		t.Errorf("Expected 2 missing hashes, got %d", len(result.MissingHashes))
	}

	if len(result.ExtraHashes) != 1 {
		t.Errorf("Expected 1 extra hash, got %d", len(result.ExtraHashes))
	}
}

func TestCompareHashLists(t *testing.T) {
	tests := []struct {
		name        string
		expected    []string
		actual      []string
		wantMatched []string
		wantMissing []string
		wantExtra   []string
	}{
		{
			name:        "Perfect match",
			expected:    []string{"hash1", "hash2", "hash3"},
			actual:      []string{"hash1", "hash2", "hash3"},
			wantMatched: []string{"hash1", "hash2", "hash3"},
			wantMissing: nil,
			wantExtra:   nil,
		},
		{
			name:        "Missing hashes",
			expected:    []string{"hash1", "hash2", "hash3"},
			actual:      []string{"hash1", "hash2"},
			wantMatched: []string{"hash1", "hash2"},
			wantMissing: []string{"hash3"},
			wantExtra:   nil,
		},
		{
			name:        "Extra hashes",
			expected:    []string{"hash1", "hash2"},
			actual:      []string{"hash1", "hash2", "hash3"},
			wantMatched: []string{"hash1", "hash2"},
			wantMissing: nil,
			wantExtra:   []string{"hash3"},
		},
		{
			name:        "Case insensitive matching",
			expected:    []string{"HASH1", "hash2"},
			actual:      []string{"hash1", "HASH2"},
			wantMatched: []string{"hash1", "hash2"},
			wantMissing: nil,
			wantExtra:   nil,
		},
		{
			name:        "No match",
			expected:    []string{"hash1", "hash2"},
			actual:      []string{"hash3", "hash4"},
			wantMatched: nil,
			wantMissing: []string{"hash1", "hash2"},
			wantExtra:   []string{"hash3", "hash4"},
		},
		{
			name:        "Empty lists",
			expected:    []string{},
			actual:      []string{},
			wantMatched: nil,
			wantMissing: nil,
			wantExtra:   nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			matched, missing, extra := compareHashLists(tt.expected, tt.actual)

			if !reflect.DeepEqual(matched, tt.wantMatched) {
				t.Errorf("Matched hashes = %v, want %v", matched, tt.wantMatched)
			}
			if !reflect.DeepEqual(missing, tt.wantMissing) {
				t.Errorf("Missing hashes = %v, want %v", missing, tt.wantMissing)
			}
			if !reflect.DeepEqual(extra, tt.wantExtra) {
				t.Errorf("Extra hashes = %v, want %v", extra, tt.wantExtra)
			}
		})
	}
}

func TestFetchAndHashURL(t *testing.T) {
	// Create test server
	testContent := "test content for hashing"
	expectedHash := HashString(testContent)

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, err := w.Write([]byte(testContent))
		if err != nil {
			t.Errorf("Unexpected error: %v", err)
		}
	}))
	defer server.Close()

	hash, err := FetchAndHashURL(server.URL)
	if err != nil {
		t.Errorf("Unexpected error: %v", err)
		return
	}

	if hash != expectedHash {
		t.Errorf("Expected hash %s, got %s", expectedHash, hash)
	}
}

func TestFetchAndHashURLError(t *testing.T) {
	// Test with non-existent URL
	_, err := FetchAndHashURL("http://localhost:99999/nonexistent")
	if err == nil {
		t.Errorf("Expected error for non-existent URL")
	}

	// Test with server error
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer server.Close()

	_, err = FetchAndHashURL(server.URL)
	if err == nil {
		t.Errorf("Expected error for 500 response")
	}
}

func TestHashString(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{
			input:    "",
			expected: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
		},
		{
			input:    "hello",
			expected: "2cf24dba4f21d4288094c4ea1e33c8fdb2d5b0d5123cac2e4eaab78d9b6a1de9",
		},
		{
			input:    "test",
			expected: "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
		},
	}

	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			result := HashString(tt.input)

			// Compute expected hash manually for verification
			hash := sha256.Sum256([]byte(tt.input))
			expected := fmt.Sprintf("%x", hash)

			if result != expected {
				t.Errorf("HashString(%q) = %s, want %s", tt.input, result, expected)
			}
		})
	}
}

func TestHashBytes(t *testing.T) {
	testData := []byte("test data")
	expectedHash := fmt.Sprintf("%x", sha256.Sum256(testData))

	result := HashBytes(testData)
	if result != expectedHash {
		t.Errorf("HashBytes() = %s, want %s", result, expectedHash)
	}
}

func TestValidateHashFormat(t *testing.T) {
	tests := []struct {
		name        string
		input       string
		expectError bool
		errorMsg    string
	}{
		{
			name:        "Valid SHA256 hash",
			input:       "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
			expectError: false,
		},
		{
			name:        "Valid hash with 0x prefix",
			input:       "0xe3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
			expectError: false,
		},
		{
			name:        "Valid hash with sha256 prefix",
			input:       "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
			expectError: false,
		},
		{
			name:        "Too short",
			input:       "abcdef",
			expectError: true,
			errorMsg:    "invalid hash length",
		},
		{
			name:        "Too long",
			input:       "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855extra",
			expectError: true,
			errorMsg:    "invalid hash length",
		},
		{
			name:        "Invalid hex characters",
			input:       "z3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
			expectError: true,
			errorMsg:    "invalid hex characters",
		},
		{
			name:        "Empty string",
			input:       "",
			expectError: true,
			errorMsg:    "invalid hash length",
		},
		{
			name:        "Uppercase valid",
			input:       "E3B0C44298FC1C149AFBF4C8996FB92427AE41E4649B934CA495991B7852B855",
			expectError: false,
		},
		{
			name:        "Mixed case valid",
			input:       "E3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
			expectError: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateHashFormat(tt.input)

			if tt.expectError {
				if err == nil {
					t.Errorf("Expected error but got none")
					return
				}
				if tt.errorMsg != "" && !strings.Contains(err.Error(), tt.errorMsg) {
					t.Errorf("Expected error containing %q, got %q", tt.errorMsg, err.Error())
				}
			} else {
				if err != nil {
					t.Errorf("Unexpected error: %v", err)
				}
			}
		})
	}
}

func TestHashBase64Content(t *testing.T) {
	// Test valid base64 content
	originalContent := "test content"
	base64Content := base64.StdEncoding.EncodeToString([]byte(originalContent))
	expectedHash := HashString(originalContent)

	hash, err := HashBase64Content(base64Content)
	if err != nil {
		t.Errorf("Unexpected error: %v", err)
		return
	}

	if hash != expectedHash {
		t.Errorf("Expected hash %s, got %s", expectedHash, hash)
	}

	// Test invalid base64
	_, err = HashBase64Content("invalid-base64!@#")
	if err == nil {
		t.Errorf("Expected error for invalid base64")
	}
}

func TestFormatHashList(t *testing.T) {
	tests := []struct {
		name     string
		input    []string
		expected string
	}{
		{
			name:     "Empty list",
			input:    []string{},
			expected: "none",
		},
		{
			name:     "Single hash",
			input:    []string{"hash1"},
			expected: "hash1",
		},
		{
			name:     "Multiple hashes",
			input:    []string{"hash1", "hash2", "hash3"},
			expected: "hash1, hash2, hash3",
		},
		{
			name:     "Nil slice",
			input:    nil,
			expected: "none",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := FormatHashList(tt.input)
			if result != tt.expected {
				t.Errorf("FormatHashList() = %s, want %s", result, tt.expected)
			}
		})
	}
}

func TestExtractHashesFromString(t *testing.T) {
	// Create valid SHA256 hashes for testing
	validHash1 := "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
	validHash2 := "2cf24dba4f21d4288094c4ea1e33c8fdb2d5b0d5123cac2e4eaab78d9b6a1de9"

	tests := []struct {
		name     string
		input    string
		expected []string
	}{
		{
			name:     "Comma separated valid hashes",
			input:    validHash1 + "," + validHash2,
			expected: []string{validHash1, validHash2},
		},
		{
			name:     "Space separated valid hashes",
			input:    validHash1 + " " + validHash2,
			expected: []string{validHash1, validHash2},
		},
		{
			name:     "Mixed delimiters",
			input:    validHash1 + "," + validHash2 + ":" + validHash1,
			expected: []string{validHash1, validHash2, validHash1},
		},
		{
			name:     "With brackets",
			input:    "[" + validHash1 + "," + validHash2 + "]",
			expected: []string{validHash1, validHash2},
		},
		{
			name:     "Invalid hashes filtered out",
			input:    validHash1 + ",invalid,short," + validHash2,
			expected: []string{validHash1, validHash2},
		},
		{
			name:     "Empty string",
			input:    "",
			expected: nil,
		},
		{
			name:     "Only invalid hashes",
			input:    "invalid,short,notahash",
			expected: nil,
		},
		{
			name:     "Single valid hash",
			input:    validHash1,
			expected: []string{validHash1},
		},
		{
			name:     "Newline separated",
			input:    validHash1 + "\n" + validHash2,
			expected: []string{validHash1, validHash2},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := ExtractHashesFromString(tt.input)
			if !reflect.DeepEqual(result, tt.expected) {
				t.Errorf("ExtractHashesFromString(%q) = %v, want %v", tt.input, result, tt.expected)
			}
		})
	}
}

func TestVerifyPlaylistAssets(t *testing.T) {
	// This function is currently not implemented
	_, err := VerifyPlaylistAssets("test-input")
	if err == nil {
		t.Errorf("Expected error for unimplemented function")
	}

	expectedMsg := "playlist asset verification requires playlist parsing integration"
	if !strings.Contains(err.Error(), expectedMsg) {
		t.Errorf("Expected error message containing %q, got %q", expectedMsg, err.Error())
	}
}

// Benchmark tests
func BenchmarkHashString(b *testing.B) {
	testString := "benchmark test string for hashing performance"

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = HashString(testString)
	}
}

func BenchmarkHashBytes(b *testing.B) {
	testBytes := []byte("benchmark test bytes for hashing performance")

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = HashBytes(testBytes)
	}
}

func BenchmarkValidateHashFormat(b *testing.B) {
	validHash := "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = ValidateHashFormat(validHash)
	}
}

func BenchmarkComputeDirectoryHashes(b *testing.B) {
	// Create a temporary directory with some test files
	tempDir := createTempDir(&testing.T{})
	defer func() {
		_ = os.RemoveAll(tempDir)
	}()

	// Create test files
	for i := 0; i < 10; i++ {
		createTestFile(&testing.T{}, filepath.Join(tempDir, fmt.Sprintf("file%d.txt", i)), fmt.Sprintf("content %d", i))
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, _ = ComputeDirectoryHashes(tempDir)
	}
}

func BenchmarkCompareHashLists(b *testing.B) {
	// Create test hash lists
	expected := make([]string, 100)
	actual := make([]string, 100)

	for i := 0; i < 100; i++ {
		hash := HashString(fmt.Sprintf("test hash %d", i))
		expected[i] = hash
		actual[i] = hash
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, _, _ = compareHashLists(expected, actual)
	}
}

func BenchmarkExtractHashesFromString(b *testing.B) {
	// Create a string with many valid hashes
	validHash := "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
	hashString := strings.Repeat(validHash+",", 50)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = ExtractHashesFromString(hashString)
	}
}
