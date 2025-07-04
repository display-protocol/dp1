package playlist

import (
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"reflect"
	"strings"
	"testing"
)

// Test constants for valid UUIDs
const (
	testPlaylistID = "385f79b6-a45f-4c1c-8080-e93a192adccc"
	testItemID1    = "285f79b6-a45f-4c1c-8080-e93a192adccc"
	testItemID2    = "185f79b6-a45f-4c1c-8080-e93a192adccc"
)

// Test data for playlist validation
var validPlaylistJSON = `{
  "dpVersion": "1.0.0",
  "id": "` + testPlaylistID + `",
  "slug": "test-playlist",
  "created": "2025-06-03T17:01:00Z",
  "defaults": {
    "display": {
      "scaling": "fit",
      "background": "#000000"
    },
    "license": "open",
    "duration": 300
  },
  "items": [
    {
      "id": "` + testItemID1 + `",
      "source": "https://example.com/artwork1.html",
      "repro": {
        "assetsSHA256": [
          "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
          "fedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321"
        ]
      }
    },
    {
      "id": "` + testItemID2 + `",
      "source": "https://example.com/artwork2.html"
    }
  ],
  "signature": "ed25519:1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
}`

func TestParsePlaylist(t *testing.T) {
	// Test data with valid JSON
	validPlaylist := `{
  "dpVersion": "1.0.0",
  "id": "` + testPlaylistID + `",
  "slug": "summer-mix-01", 
  "created": "2025-06-03T17:01:00Z",
  "items": [
    {
      "id": "` + testItemID1 + `",
      "slug": "payphone-v2",
      "title": "Payphone",
      "source": "https://cdn.feralfile.com/payphone/index.html",
      "duration": 300,
      "license": "open"
    },
    {
      "id": "` + testItemID2 + `",
      "title": "Another Artwork",
      "source": "https://example.com/art.html",
      "duration": 180
    }
  ],
  "signature": "ed25519:1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
}`

	tests := []struct {
		name        string
		input       string
		expectError bool
		checkID     string
	}{
		{
			name:        "Valid JSON playlist",
			input:       validPlaylist,
			expectError: false,
			checkID:     testPlaylistID,
		},
		{
			name:        "Valid base64 encoded JSON",
			input:       base64.StdEncoding.EncodeToString([]byte(validPlaylist)),
			expectError: false,
			checkID:     testPlaylistID,
		},
		{
			name:        "Invalid JSON",
			input:       `{"invalid": json}`,
			expectError: true,
		},
		{
			name:        "Invalid base64",
			input:       "invalid-base64-data!@#",
			expectError: true,
		},
		{
			name:        "Empty input",
			input:       "",
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			playlist, _, err := ParsePlaylist(tt.input)

			if tt.expectError {
				if err == nil {
					t.Errorf("Expected error but got none")
				}
				return
			}

			if err != nil {
				t.Errorf("Unexpected error: %v", err)
				return
			}

			if playlist == nil {
				t.Errorf("Expected non-nil playlist")
				return
			}

			if tt.checkID != "" && playlist.ID != tt.checkID {
				t.Errorf("Expected ID %s, got %s", tt.checkID, playlist.ID)
			}
		})
	}
}

func TestParsePlaylistWithURL(t *testing.T) {
	// Create test server
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, err := w.Write([]byte(validPlaylistJSON))
		if err != nil {
			t.Errorf("Unexpected error writing to response writer: %v", err)
		}
	}))
	defer server.Close()

	// Test with URL
	playlist, _, err := ParsePlaylist(server.URL)
	if err != nil {
		t.Errorf("Unexpected error parsing from URL: %v", err)
		return
	}

	if playlist.ID != testPlaylistID {
		t.Errorf("Expected correct ID from URL request")
	}
}

func TestParsePlaylistHTTPError(t *testing.T) {
	// Create test server that returns error
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNotFound)
	}))
	defer server.Close()

	// Test with URL that returns 404
	_, _, err := ParsePlaylist(server.URL)
	if err == nil {
		t.Errorf("Expected error for 404 response")
	}
}

func TestIsURL(t *testing.T) {
	tests := []struct {
		input    string
		expected bool
	}{
		{"https://example.com", true},
		{"http://localhost:8080", true},
		{"ftp://files.example.com", true},
		{"not-a-url", false},
		{"", false},
		{"just-text", false},
		{"/local/path", false},
		{"mailto:test@example.com", false}, // This doesn't have a proper host part for URL parsing
	}

	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			result := isURL(tt.input)
			if result != tt.expected {
				t.Errorf("isURL(%q) = %v, want %v", tt.input, result, tt.expected)
			}
		})
	}
}

func TestCanonicalizePlaylist(t *testing.T) {
	// Create test playlist
	playlist := &Playlist{
		DPVersion: "1.0.0",
		ID:        testPlaylistID,
		Created:   "2025-06-03T17:01:00Z",
		Items: []PlaylistItem{
			{
				ID:     testItemID1,
				Source: "https://example.com",
			},
		},
		Signature: "ed25519:0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
	}

	canonical, err := CanonicalizePlaylist(playlist, false)
	if err != nil {
		t.Errorf("Unexpected error: %v", err)
		return
	}

	// Check that result is valid JSON
	var obj map[string]any
	if err := json.Unmarshal(canonical, &obj); err != nil {
		t.Errorf("Canonical output is not valid JSON: %v", err)
	}

	// Test that canonicalization is deterministic
	canonical2, err := CanonicalizePlaylist(playlist, false)
	if err != nil {
		t.Errorf("Unexpected error on second canonicalization: %v", err)
		return
	}

	if !reflect.DeepEqual(canonical, canonical2) {
		t.Errorf("Canonicalization is not deterministic")
	}

	// Check that canonical form ends with LF terminator
	if len(canonical) == 0 || canonical[len(canonical)-1] != '\n' {
		t.Errorf("Canonical form should end with LF terminator")
	}

	// Check that signable canonical form doesn't have signature
	canonical3, err := CanonicalizePlaylist(playlist, true)
	if err != nil {
		t.Errorf("Unexpected error on third canonicalization: %v", err)
		return
	}

	// Unmarshal the signable canonical form
	var signableObj map[string]any
	if err := json.Unmarshal(canonical3, &signableObj); err != nil {
		t.Errorf("Unexpected error on json unmarshal third canonicalization: %v", err)
		return
	}

	// Check if signature has been removed
	sig, ok := signableObj["signature"].(string)
	if ok && len(sig) > 0 {
		t.Error("Signature canonical form should have signature removed")
	}
}

func TestValidatePlaylistStructure(t *testing.T) {
	validUUID := testPlaylistID
	validItemUUID := testItemID1

	tests := []struct {
		name        string
		playlist    *Playlist
		expectError bool
		errorMsg    string
	}{
		{
			name: "Valid playlist",
			playlist: &Playlist{
				DPVersion: "1.0.0",
				ID:        validUUID,
				Created:   "2025-06-03T17:01:00Z",
				Items: []PlaylistItem{
					{ID: validItemUUID, Source: "https://example.com"},
				},
			},
			expectError: false,
		},
		{
			name: "Missing dpVersion",
			playlist: &Playlist{
				ID:      validUUID,
				Created: "2025-06-03T17:01:00Z",
				Items: []PlaylistItem{
					{ID: validItemUUID, Source: "https://example.com"},
				},
			},
			expectError: true,
			errorMsg:    "missing required field: dpversion",
		},
		{
			name: "Missing ID",
			playlist: &Playlist{
				DPVersion: "1.0.0",
				Created:   "2025-06-03T17:01:00Z",
				Items: []PlaylistItem{
					{ID: validItemUUID, Source: "https://example.com"},
				},
			},
			expectError: true,
			errorMsg:    "missing required field: id",
		},
		{
			name: "Missing created",
			playlist: &Playlist{
				DPVersion: "1.0.0",
				ID:        validUUID,
				Items: []PlaylistItem{
					{ID: validItemUUID, Source: "https://example.com"},
				},
			},
			expectError: true,
			errorMsg:    "missing required field: created",
		},
		{
			name: "Invalid created timestamp",
			playlist: &Playlist{
				DPVersion: "1.0.0",
				ID:        validUUID,
				Created:   "not-a-timestamp",
				Items: []PlaylistItem{
					{ID: validItemUUID, Source: "https://example.com"},
				},
			},
			expectError: true,
			errorMsg:    "invalid created timestamp format",
		},
		{
			name: "No items",
			playlist: &Playlist{
				DPVersion: "1.0.0",
				ID:        validUUID,
				Created:   "2025-06-03T17:01:00Z",
				Items:     []PlaylistItem{},
			},
			expectError: true,
			errorMsg:    "playlist must contain at least one item",
		},
		{
			name: "Item missing ID",
			playlist: &Playlist{
				DPVersion: "1.0.0",
				ID:        validUUID,
				Created:   "2025-06-03T17:01:00Z",
				Items: []PlaylistItem{
					{Source: "https://example.com"},
				},
			},
			expectError: true,
			errorMsg:    "missing required field: id",
		},
		{
			name: "Item missing source",
			playlist: &Playlist{
				DPVersion: "1.0.0",
				ID:        validUUID,
				Created:   "2025-06-03T17:01:00Z",
				Items: []PlaylistItem{
					{ID: validItemUUID},
				},
			},
			expectError: true,
			errorMsg:    "missing required field: source",
		},
		{
			name: "Invalid UUID format",
			playlist: &Playlist{
				DPVersion: "1.0.0",
				ID:        "invalid-uuid",
				Created:   "2025-06-03T17:01:00Z",
				Items: []PlaylistItem{
					{ID: validItemUUID, Source: "https://example.com"},
				},
			},
			expectError: true,
			errorMsg:    "invalid UUID format",
		},
		{
			name: "Invalid semver",
			playlist: &Playlist{
				DPVersion: "invalid-version",
				ID:        validUUID,
				Created:   "2025-06-03T17:01:00Z",
				Items: []PlaylistItem{
					{ID: validItemUUID, Source: "https://example.com"},
				},
			},
			expectError: true,
			errorMsg:    "invalid semantic version format",
		},
		{
			name: "Invalid URL",
			playlist: &Playlist{
				DPVersion: "1.0.0",
				ID:        validUUID,
				Created:   "2025-06-03T17:01:00Z",
				Items: []PlaylistItem{
					{ID: validItemUUID, Source: "not-a-url"},
				},
			},
			expectError: true,
			errorMsg:    "invalid URL format",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidatePlaylistStructure(tt.playlist)

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

func TestHasSignature(t *testing.T) {
	tests := []struct {
		name     string
		playlist *Playlist
		expected bool
	}{
		{
			name: "With signature",
			playlist: &Playlist{
				Signature: "ed25519:abcdef123456",
			},
			expected: true,
		},
		{
			name: "Without signature",
			playlist: &Playlist{
				Signature: "",
			},
			expected: false,
		},
		{
			name:     "Nil signature field",
			playlist: &Playlist{},
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := HasSignature(tt.playlist)
			if result != tt.expected {
				t.Errorf("HasSignature() = %v, want %v", result, tt.expected)
			}
		})
	}
}

func TestExtractAssetHashes(t *testing.T) {
	tests := []struct {
		name     string
		playlist *Playlist
		expected []string
	}{
		{
			name: "Multiple items with hashes",
			playlist: &Playlist{
				Items: []PlaylistItem{
					{
						Repro: &ReproBlock{
							AssetsSHA256: []string{"hash1", "hash2"},
						},
					},
					{
						Repro: &ReproBlock{
							AssetsSHA256: []string{"hash3"},
						},
					},
				},
			},
			expected: []string{"hash1", "hash2", "hash3"},
		},
		{
			name: "No repro blocks",
			playlist: &Playlist{
				Items: []PlaylistItem{
					{ID: testItemID1},
					{ID: testItemID2},
				},
			},
			expected: nil,
		},
		{
			name: "Mixed items",
			playlist: &Playlist{
				Items: []PlaylistItem{
					{ID: testItemID1}, // No repro
					{
						Repro: &ReproBlock{
							AssetsSHA256: []string{"hash1"},
						},
					},
					{
						Repro: &ReproBlock{}, // Empty assets
					},
				},
			},
			expected: []string{"hash1"},
		},
		{
			name:     "Empty playlist",
			playlist: &Playlist{Items: []PlaylistItem{}},
			expected: nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := ExtractAssetHashes(tt.playlist)
			if !reflect.DeepEqual(result, tt.expected) {
				t.Errorf("ExtractAssetHashes() = %v, want %v", result, tt.expected)
			}
		})
	}
}

func TestCanonicalizeJSON(t *testing.T) {
	tests := []struct {
		name     string
		input    any
		expected string
	}{
		{
			name: "Simple object",
			input: map[string]any{
				"b": "value2",
				"a": "value1",
			},
			expected: `{"a":"value1","b":"value2"}`,
		},
		{
			name: "Nested object",
			input: map[string]any{
				"outer": map[string]any{
					"z": "last",
					"a": "first",
				},
			},
			expected: `{"outer":{"a":"first","z":"last"}}`,
		},
		{
			name:     "Array",
			input:    []any{"c", "a", "b"},
			expected: `["c","a","b"]`,
		},
		{
			name:     "String",
			input:    "simple string",
			expected: `"simple string"`,
		},
		{
			name:     "Number",
			input:    42,
			expected: `42`,
		},
		{
			name:     "Boolean",
			input:    true,
			expected: `true`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := canonicalizeJSON(tt.input)
			if err != nil {
				t.Errorf("Unexpected error: %v", err)
				return
			}

			if string(result) != tt.expected {
				t.Errorf("canonicalizeJSON() = %s, want %s", string(result), tt.expected)
			}
		})
	}
}

// Benchmark tests
func BenchmarkParsePlaylist(b *testing.B) {
	for range b.N {
		_, _, _ = ParsePlaylist(validPlaylistJSON)
	}
}

func BenchmarkCanonicalizePlaylist(b *testing.B) {
	playlist := &Playlist{
		DPVersion: "1.0.0",
		ID:        testPlaylistID,
		Created:   "2025-06-03T17:01:00Z",
		Items: []PlaylistItem{
			{ID: testItemID1, Source: "https://example.com"},
		},
	}

	b.ResetTimer()
	for range b.N {
		_, _ = CanonicalizePlaylist(playlist, false)
	}
}
