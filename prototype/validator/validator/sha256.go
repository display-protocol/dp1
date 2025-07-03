package validator

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"runtime"
	"sort"
	"strings"
	"sync"
)

// HashResult represents the hash of a single file
type HashResult struct {
	Path   string `json:"path"`
	SHA256 string `json:"sha256"`
	Size   int64  `json:"size"`
	IsDir  bool   `json:"isDir"`
	Error  string `json:"error,omitempty"`
}

// FileJob represents a file to be processed
type FileJob struct {
	Path    string
	RelPath string
	Info    os.FileInfo
}

// VerificationResult represents the result of hash verification
type VerificationResult struct {
	Success       bool         `json:"success"`
	TotalFiles    int          `json:"totalFiles"`
	MatchedHashes int          `json:"matchedHashes"`
	MissingHashes []string     `json:"missingHashes,omitempty"`
	ExtraHashes   []string     `json:"extraHashes,omitempty"`
	Results       []HashResult `json:"results"`
	ErrorMessage  string       `json:"errorMessage,omitempty"`
}

// ComputeDirectoryHashes computes SHA256 hashes for all files in a directory recursively using concurrent processing
func ComputeDirectoryHashes(dirPath string) ([]HashResult, error) {
	// Verify directory exists
	info, err := os.Stat(dirPath)
	if err != nil {
		return nil, fmt.Errorf("failed to access directory: %w", err)
	}
	if !info.IsDir() {
		return nil, fmt.Errorf("path is not a directory: %s", dirPath)
	}

	// First, gather all files
	var fileJobs []FileJob
	err = filepath.Walk(dirPath, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			// Create error result but continue walking
			relPath, _ := filepath.Rel(dirPath, path)
			fileJobs = append(fileJobs, FileJob{
				Path:    path,
				RelPath: relPath,
				Info:    info,
			})
			return nil
		}

		// Skip directories themselves, only process files
		if !info.IsDir() {
			relPath, err := filepath.Rel(dirPath, path)
			if err != nil {
				relPath = path
			}
			fileJobs = append(fileJobs, FileJob{
				Path:    path,
				RelPath: relPath,
				Info:    info,
			})
		}
		return nil
	})

	if err != nil {
		return nil, fmt.Errorf("failed to walk directory: %w", err)
	}

	// Process files concurrently
	results := processFilesConcurrently(fileJobs)

	// Sort results by path for consistent ordering
	sort.Slice(results, func(i, j int) bool {
		return results[i].Path < results[j].Path
	})

	return results, nil
}

// processFilesConcurrently processes files using a worker pool pattern
func processFilesConcurrently(fileJobs []FileJob) []HashResult {
	if len(fileJobs) == 0 {
		return []HashResult{}
	}

	// Determine number of workers (CPU cores, but capped for reasonable concurrency)
	numWorkers := min(
		len(fileJobs),
		min(runtime.NumCPU(), 8),
	)

	// Create channels
	jobChan := make(chan FileJob, len(fileJobs))
	resultChan := make(chan HashResult, len(fileJobs))

	// Start workers
	var wg sync.WaitGroup
	for range numWorkers {
		wg.Add(1)
		go func() {
			defer wg.Done()
			worker(jobChan, resultChan)
		}()
	}

	// Send jobs
	for _, job := range fileJobs {
		jobChan <- job
	}
	close(jobChan)

	// Wait for workers to finish and close result channel
	go func() {
		wg.Wait()
		close(resultChan)
	}()

	// Collect results
	var results []HashResult
	for result := range resultChan {
		results = append(results, result)
	}

	return results
}

// worker processes FileJobs and sends HashResults
func worker(jobChan <-chan FileJob, resultChan chan<- HashResult) {
	for job := range jobChan {
		result := HashResult{
			Path:  job.RelPath,
			Size:  job.Info.Size(),
			IsDir: false,
		}

		// If there was an error during file walking, record it
		if job.Info == nil {
			result.Error = "failed to access file during directory walk"
		} else {
			// Compute file hash
			hash, err := computeFileHash(job.Path)
			if err != nil {
				result.Error = err.Error()
			} else {
				result.SHA256 = hash
			}
		}

		resultChan <- result
	}
}

// computeFileHash computes SHA256 hash of a single file
func computeFileHash(filePath string) (string, error) {
	//nolint:gosec
	file, err := os.Open(filePath)
	if err != nil {
		return "", err
	}
	defer func() {
		_ = file.Close()
	}()

	hash := sha256.New()
	if _, err := io.Copy(hash, file); err != nil {
		return "", err
	}

	return fmt.Sprintf("%x", hash.Sum(nil)), nil
}

// VerifyDirectoryHashes verifies that computed hashes match expected hashes
func VerifyDirectoryHashes(dirPath string, expectedHashes []string) (*VerificationResult, error) {
	// Compute actual hashes
	results, err := ComputeDirectoryHashes(dirPath)
	if err != nil {
		return &VerificationResult{
			Success:      false,
			ErrorMessage: err.Error(),
		}, err
	}

	// Extract computed hashes (only successful ones)
	var computedHashes []string
	for _, result := range results {
		if result.Error == "" && result.SHA256 != "" {
			computedHashes = append(computedHashes, result.SHA256)
		}
	}

	// Compare hashes
	matched, missing, extra := CompareHashLists(expectedHashes, computedHashes)

	success := len(missing) == 0 && len(extra) == 0

	return &VerificationResult{
		Success:       success,
		TotalFiles:    len(results),
		MatchedHashes: len(matched),
		MissingHashes: missing,
		ExtraHashes:   extra,
		Results:       results,
	}, nil
}

// CompareHashLists compares two lists of hashes and returns matched, missing, and extra hashes
func CompareHashLists(expected, actual []string) (matched, missing, extra []string) {
	expectedMap := make(map[string]bool)
	actualMap := make(map[string]bool)

	// Build maps for efficient lookup
	for _, hash := range expected {
		expectedMap[strings.ToLower(hash)] = true
	}
	for _, hash := range actual {
		actualMap[strings.ToLower(hash)] = true
	}

	// Find matches and missing hashes
	for hash := range expectedMap {
		if actualMap[hash] {
			matched = append(matched, hash)
		} else {
			missing = append(missing, hash)
		}
	}

	// Find extra hashes
	for hash := range actualMap {
		if !expectedMap[hash] {
			extra = append(extra, hash)
		}
	}

	sort.Strings(matched)
	sort.Strings(missing)
	sort.Strings(extra)

	return matched, missing, extra
}

// HashString computes SHA256 hash of a string
func HashString(input string) string {
	hash := sha256.Sum256([]byte(input))
	return fmt.Sprintf("%x", hash)
}

// HashBytes computes SHA256 hash of byte slice
func HashBytes(input []byte) string {
	hash := sha256.Sum256(input)
	return fmt.Sprintf("%x", hash)
}

// ValidateHashFormat validates that a string is a valid SHA256 hash
func ValidateHashFormat(hash string) error {
	// Remove any prefixes
	hash = strings.TrimPrefix(hash, "0x")
	hash = strings.TrimPrefix(hash, "sha256:")

	// Check length (SHA256 is 64 hex characters)
	if len(hash) != 64 {
		return fmt.Errorf("invalid hash length: expected 64 characters, got %d", len(hash))
	}

	// Check if all characters are valid hex
	_, err := hex.DecodeString(hash)
	if err != nil {
		return fmt.Errorf("invalid hex characters in hash: %w", err)
	}

	return nil
}

// ExtractHashesFromString extracts valid SHA256 hashes from a string
// This can be useful for parsing hash lists from various formats
func ExtractHashesFromString(input string) []string {
	var validHashes []string

	// Split by common delimiters
	parts := strings.FieldsFunc(input, func(r rune) bool {
		return r == ',' || r == ':' || r == ';' || r == '\n' || r == '\t' || r == ' '
	})

	for _, part := range parts {
		part = strings.TrimSpace(part)
		part = strings.Trim(part, "[](){}")

		if ValidateHashFormat(part) == nil {
			validHashes = append(validHashes, strings.ToLower(part))
		}
	}

	return validHashes
}
