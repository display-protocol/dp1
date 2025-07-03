package playlist

import (
	"bytes"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"sort"
	"strings"
	"time"

	"github.com/go-playground/validator/v10"
)

// Global validator instance
var validate *validator.Validate

func init() {
	validate = validator.New()
}

// PlaylistItem represents a single item in a DP-1 playlist
type PlaylistItem struct {
	ID         string           `json:"id" validate:"required,uuid4"`
	Slug       string           `json:"slug,omitempty" validate:"omitempty,max=100"`
	Title      string           `json:"title,omitempty" validate:"omitempty,max=500"`
	Source     string           `json:"source" validate:"required,url"`
	Duration   int              `json:"duration,omitempty" validate:"omitempty,min=0"`
	License    string           `json:"license,omitempty" validate:"omitempty,oneof=open token subscription"`
	Ref        string           `json:"ref,omitempty" validate:"omitempty,url"`
	Override   map[string]any   `json:"override,omitempty"`
	Display    map[string]any   `json:"display,omitempty"`
	Repro      *ReproBlock      `json:"repro,omitempty" validate:"omitempty"`
	Provenance *ProvenanceBlock `json:"provenance,omitempty" validate:"omitempty"`
}

// ReproBlock represents reproduction verification data
type ReproBlock struct {
	EngineVersion map[string]string `json:"engineVersion,omitempty"`
	Seed          string            `json:"seed,omitempty" validate:"omitempty,hexadecimal"`
	AssetsSHA256  []string          `json:"assetsSHA256,omitempty" validate:"omitempty,dive,len=64,hexadecimal"`
	FrameHash     map[string]string `json:"frameHash,omitempty"`
}

// ProvenanceBlock represents provenance information
type ProvenanceBlock struct {
	Type         string           `json:"type" validate:"required,oneof=onChain seriesRegistry offChainURI"`
	Contract     map[string]any   `json:"contract,omitempty"`
	Dependencies []map[string]any `json:"dependencies,omitempty"`
}

// Playlist represents a DP-1 playlist
type Playlist struct {
	DPVersion string         `json:"dpVersion" validate:"required,semver"`
	ID        string         `json:"id" validate:"required,uuid4"`
	Slug      string         `json:"slug,omitempty" validate:"omitempty,max=100,alphanum|contains=-|contains=_"`
	Created   string         `json:"created" validate:"required,datetime=2006-01-02T15:04:05Z"`
	Defaults  map[string]any `json:"defaults,omitempty"`
	Items     []PlaylistItem `json:"items" validate:"required,min=1,dive"`
	Signature string         `json:"signature,omitempty" validate:"omitempty,startswith=ed25519:"`
}

// ParsePlaylist parses a playlist from either a URL or base64 encoded payload
func ParsePlaylist(input string) (*Playlist, []byte, error) {
	var rawData []byte
	var err error

	// Auto-detect if input is URL or base64
	if isURL(input) {
		rawData, err = fetchFromURL(input)
		if err != nil {
			return nil, nil, fmt.Errorf("failed to fetch playlist from URL: %w", err)
		}
	} else {
		// Try to decode as base64
		rawData, err = base64.StdEncoding.DecodeString(input)
		if err != nil {
			// If base64 decoding fails, treat as raw JSON
			rawData = []byte(input)
		}
	}

	var playlist Playlist
	if err := json.Unmarshal(rawData, &playlist); err != nil {
		return nil, nil, fmt.Errorf("failed to parse playlist JSON: %w", err)
	}

	return &playlist, rawData, nil
}

// isURL checks if the input string is a valid URL
func isURL(input string) bool {
	u, err := url.Parse(input)
	return err == nil && u.Scheme != "" && u.Host != ""
}

// fetchFromURL fetches content from a URL with proper timeout and headers
func fetchFromURL(urlStr string) ([]byte, error) {
	client := &http.Client{
		Timeout: 30 * time.Second,
	}

	req, err := http.NewRequest("GET", urlStr, nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("User-Agent", "DP-1-Validator/1.0")
	req.Header.Set("Accept", "application/json")

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer func() {
		_ = resp.Body.Close()
	}()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("HTTP %d: %s", resp.StatusCode, resp.Status)
	}

	return io.ReadAll(resp.Body)
}

// CanonicalizePlaylist converts a playlist to canonical JSON form
// This removes unnecessary whitespace and ensures consistent field ordering
func CanonicalizePlaylist(playlist *Playlist) ([]byte, error) {
	// Convert to map for sorting
	data, err := json.Marshal(playlist)
	if err != nil {
		return nil, err
	}

	var obj map[string]any
	if err := json.Unmarshal(data, &obj); err != nil {
		return nil, err
	}

	return canonicalizeJSON(obj)
}

// canonicalizeJSON recursively sorts JSON objects by keys to ensure deterministic output
func canonicalizeJSON(obj any) ([]byte, error) {
	switch v := obj.(type) {
	case map[string]any:
		// Sort keys for deterministic output
		keys := make([]string, 0, len(v))
		for k := range v {
			keys = append(keys, k)
		}
		sort.Strings(keys)

		var buf bytes.Buffer
		buf.WriteByte('{')
		for i, k := range keys {
			if i > 0 {
				buf.WriteByte(',')
			}
			keyBytes, _ := json.Marshal(k)
			buf.Write(keyBytes)
			buf.WriteByte(':')
			valueBytes, err := canonicalizeJSON(v[k])
			if err != nil {
				return nil, err
			}
			buf.Write(valueBytes)
		}
		buf.WriteByte('}')
		return buf.Bytes(), nil

	case []any:
		var buf bytes.Buffer
		buf.WriteByte('[')
		for i, item := range v {
			if i > 0 {
				buf.WriteByte(',')
			}
			itemBytes, err := canonicalizeJSON(item)
			if err != nil {
				return nil, err
			}
			buf.Write(itemBytes)
		}
		buf.WriteByte(']')
		return buf.Bytes(), nil

	default:
		return json.Marshal(v)
	}
}

// GetPlaylistHash returns a SHA-256 hash of the canonical playlist representation
// This can be used to detect duplicate playlists regardless of field order
func GetPlaylistHash(playlist *Playlist) (string, error) {
	canonical, err := CanonicalizePlaylist(playlist)
	if err != nil {
		return "", err
	}

	hash := sha256.Sum256(canonical)
	return fmt.Sprintf("%x", hash), nil
}

// GetSignableContent returns the content that should be signed (without signature field)
func GetSignableContent(rawData []byte) ([]byte, error) {
	var obj map[string]any
	if err := json.Unmarshal(rawData, &obj); err != nil {
		return nil, err
	}

	// Remove signature field for verification
	delete(obj, "signature")

	return canonicalizeJSON(obj)
}

// ValidatePlaylistStructure validates the playlist structure using the validator library
func ValidatePlaylistStructure(playlist *Playlist) error {
	if playlist == nil {
		return fmt.Errorf("playlist cannot be nil")
	}

	// Use the validator library to validate the struct
	if err := validate.Struct(playlist); err != nil {
		// Convert validation errors to more user-friendly messages
		var validationErrors validator.ValidationErrors
		if errors.As(err, &validationErrors) {
			for _, fieldError := range validationErrors {
				switch fieldError.Tag() {
				case "required":
					return fmt.Errorf("missing required field: %s", strings.ToLower(fieldError.Field()))
				case "uuid4":
					return fmt.Errorf("invalid UUID format for field: %s", strings.ToLower(fieldError.Field()))
				case "semver":
					return fmt.Errorf("invalid semantic version format for dpVersion: %s", fieldError.Value())
				case "datetime":
					return fmt.Errorf("invalid created timestamp format, expected RFC3339: %s", fieldError.Value())
				case "min":
					if fieldError.Field() == "Items" {
						return fmt.Errorf("playlist must contain at least one item")
					}
					return fmt.Errorf("field %s must have minimum value/length of %s", strings.ToLower(fieldError.Field()), fieldError.Param())
				case "url":
					return fmt.Errorf("invalid URL format for field %s: %s", strings.ToLower(fieldError.Field()), fieldError.Value())
				case "oneof":
					return fmt.Errorf("invalid value for field %s, must be one of: %s", strings.ToLower(fieldError.Field()), fieldError.Param())
				case "hexadecimal":
					return fmt.Errorf("field %s must be hexadecimal: %s", strings.ToLower(fieldError.Field()), fieldError.Value())
				case "len":
					return fmt.Errorf("field %s must be exactly %s characters long", strings.ToLower(fieldError.Field()), fieldError.Param())
				case "startswith":
					return fmt.Errorf("field %s must start with: %s", strings.ToLower(fieldError.Field()), fieldError.Param())
				case "dive":
					// Handle array/slice validation errors
					return fmt.Errorf("validation error in %s array", strings.ToLower(fieldError.Field()))
				default:
					return fmt.Errorf("validation error for field %s: %s", strings.ToLower(fieldError.Field()), fieldError.Tag())
				}
			}
		}
		return fmt.Errorf("validation failed: %w", err)
	}

	return nil
}

// HasSignature checks if the playlist contains a signature
func HasSignature(playlist *Playlist) bool {
	return playlist.Signature != ""
}

// ExtractAssetHashes extracts SHA256 hashes from the repro block of all playlist items
func ExtractAssetHashes(playlist *Playlist) []string {
	var allHashes []string

	for _, item := range playlist.Items {
		if item.Repro != nil && len(item.Repro.AssetsSHA256) > 0 {
			allHashes = append(allHashes, item.Repro.AssetsSHA256...)
		}
	}

	return allHashes
}
