package playlist

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/go-playground/validator/v10"
	"github.com/gowebpki/jcs"
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
	Title      string           `json:"title,omitempty" validate:"omitempty,max=256"`
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
	Title     string         `json:"title,omitempty" validate:"required,max=256"`
	Created   string         `json:"created" validate:"required,datetime=2006-01-02T15:04:05Z"`
	Defaults  map[string]any `json:"defaults,omitempty"`
	Items     []PlaylistItem `json:"items" validate:"required,min=1,dive"`
	Signature *string        `json:"signature,omitempty" validate:"omitempty,startswith=ed25519:"`
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
func CanonicalizePlaylist(playlist *Playlist, signable bool) ([]byte, error) {
	if signable {
		playlist.Signature = nil
	}

	// Marshal to JSON first
	rawJson, err := json.Marshal(playlist)
	if err != nil {
		return nil, err
	}

	// Transform to canonical JSON
	canonical, err := jcs.Transform(rawJson)
	if err != nil {
		return nil, err
	}

	// Add LF terminator if not already present
	if len(canonical) > 0 && canonical[len(canonical)-1] != '\n' {
		canonical = append(canonical, '\n')
	}

	return canonical, nil
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
	return playlist.Signature != nil && *playlist.Signature != ""
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
