package validator

import (
	"archive/tar"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"

	"github.com/feral-file/dp-1/validator/playlist"
	"github.com/klauspost/compress/zstd"
)

const (
	// Maximum size limits to prevent decompression bombs
	maxTotalExtractedSize = 2 * 1024 * 1024 * 1024 // 2GB total
	maxSingleFileSize     = 1 * 1024 * 1024 * 1024 // 1GB per file
	maxCompressionRatio   = 100                    // Max 100:1 compression ratio
)

// limitedReader wraps an io.Reader and limits the number of bytes that can be read
type limitedReader struct {
	reader io.Reader
	limit  int64
	read   int64
}

func (lr *limitedReader) Read(p []byte) (int, error) {
	if lr.read >= lr.limit {
		return 0, fmt.Errorf("size limit exceeded: %d bytes", lr.limit)
	}

	// Limit the read to not exceed our limit
	if int64(len(p)) > lr.limit-lr.read {
		p = p[:lr.limit-lr.read]
	}

	n, err := lr.reader.Read(p)
	lr.read += int64(n)
	return n, err
}

// CapsuleInfo represents information about an extracted capsule
type CapsuleInfo struct {
	ExtractPath  string             `json:"extractPath"`
	PlaylistPath string             `json:"playlistPath"`
	AssetsPath   string             `json:"assetsPath"`
	Playlist     *playlist.Playlist `json:"playlist"`
}

// validateArchiveEntryName validates that an archive entry name is safe to extract
func validateArchiveEntryName(name string) error {
	// Check for empty name
	if name == "" {
		return fmt.Errorf("empty entry name")
	}

	// Clean the path and check for directory traversal attempts
	cleanName := filepath.Clean(name)

	// Reject paths that contain .. components (directory traversal)
	if strings.Contains(cleanName, "..") {
		return fmt.Errorf("path contains directory traversal: %s", name)
	}

	// Reject absolute paths
	if filepath.IsAbs(cleanName) {
		return fmt.Errorf("absolute paths not allowed: %s", name)
	}

	// Reject paths starting with / or \
	if strings.HasPrefix(name, "/") || strings.HasPrefix(name, "\\") {
		return fmt.Errorf("paths starting with separator not allowed: %s", name)
	}

	// Additional check for cleaned path being different from original (suspicious)
	if cleanName != name && cleanName != strings.TrimRight(name, "/") {
		return fmt.Errorf("suspicious path detected: %s", name)
	}

	return nil
}

// ExtractCapsule extracts a .dp1c file to a temporary directory and validates its structure
func ExtractCapsule(capsulePath string) (*CapsuleInfo, error) {
	// Validate file extension
	if !strings.HasSuffix(strings.ToLower(capsulePath), ".dp1c") {
		return nil, fmt.Errorf("file must have .dp1c extension, got: %s", filepath.Ext(capsulePath))
	}

	// Check if file exists and is readable
	if _, err := os.Stat(capsulePath); err != nil {
		return nil, fmt.Errorf("cannot access capsule file: %w", err)
	}

	// Create temporary directory for extraction
	tempDir, err := os.MkdirTemp("", "dp1c-extract-*")
	if err != nil {
		return nil, fmt.Errorf("failed to create temporary directory: %w", err)
	}

	// Extract the capsule
	if err := extractTarZstd(capsulePath, tempDir); err != nil {
		_ = os.RemoveAll(tempDir) // Clean up on error
		return nil, fmt.Errorf("failed to extract capsule: %w", err)
	}

	// Validate capsule structure
	info, err := validateCapsuleStructure(tempDir)
	if err != nil {
		_ = os.RemoveAll(tempDir) // Clean up on error
		return nil, fmt.Errorf("invalid capsule structure: %w", err)
	}

	return info, nil
}

// extractTarZstd extracts a tar+zstd archive to the specified directory
func extractTarZstd(archivePath, destDir string) error {
	// Clean and validate the archive path to prevent path traversal
	cleanArchivePath := filepath.Clean(archivePath)

	// Additional security check: ensure the path doesn't contain suspicious patterns
	if strings.Contains(cleanArchivePath, "..") {
		return fmt.Errorf("invalid archive path: path traversal not allowed")
	}

	// Verify the file exists and is a regular file
	fileInfo, err := os.Stat(cleanArchivePath)
	if err != nil {
		return fmt.Errorf("failed to stat archive file: %w", err)
	}
	if !fileInfo.Mode().IsRegular() {
		return fmt.Errorf("archive path must be a regular file")
	}

	// Open the archive file with cleaned path
	file, err := os.Open(cleanArchivePath)
	if err != nil {
		return fmt.Errorf("failed to open archive: %w", err)
	}
	defer func() { _ = file.Close() }()

	// Create zstd decoder
	decoder, err := zstd.NewReader(file)
	if err != nil {
		return fmt.Errorf("failed to create zstd decoder: %w", err)
	}
	defer decoder.Close()

	// Create tar reader
	tarReader := tar.NewReader(decoder)

	// Track total extracted size to prevent decompression bombs
	var totalExtracted int64

	// Extract files
	for {
		header, err := tarReader.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			return fmt.Errorf("failed to read tar header: %w", err)
		}

		// Validate archive entry name to prevent tar slip attacks
		if err := validateArchiveEntryName(header.Name); err != nil {
			return fmt.Errorf("invalid archive entry: %w", err)
		}

		// Construct the full path
		//nolint:gosec // G304: We've checked for path traversal
		destPath := filepath.Join(destDir, header.Name)

		// Security check: ensure path is within destination directory
		if !strings.HasPrefix(destPath, filepath.Clean(destDir)+string(os.PathSeparator)) &&
			destPath != filepath.Clean(destDir) {
			return fmt.Errorf("invalid file path in archive: %s", header.Name)
		}

		switch header.Typeflag {
		case tar.TypeDir:
			// Create directory
			//nolint:gosec // G115: We've checked for path traversal
			if err := os.MkdirAll(destPath, os.FileMode(header.Mode)); err != nil {
				return fmt.Errorf("failed to create directory %s: %w", destPath, err)
			}

		case tar.TypeReg:
			// Check individual file size limit before extraction
			if header.Size > maxSingleFileSize {
				return fmt.Errorf("file %s exceeds maximum size limit (%d bytes > %d bytes)",
					header.Name, header.Size, maxSingleFileSize)
			}

			// Check total extraction size limit
			if totalExtracted+header.Size > maxTotalExtractedSize {
				return fmt.Errorf("total extraction size would exceed limit (%d + %d > %d bytes)",
					totalExtracted, header.Size, maxTotalExtractedSize)
			}

			// Create parent directories if needed
			if err := os.MkdirAll(filepath.Dir(destPath), 0750); err != nil {
				return fmt.Errorf("failed to create parent directory for %s: %w", destPath, err)
			}

			// Create file
			//nolint:gosec // G304: We've checked for path traversal
			outFile, err := os.OpenFile(destPath, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, os.FileMode(header.Mode))
			if err != nil {
				return fmt.Errorf("failed to create file %s: %w", destPath, err)
			}

			// Create a limited reader to prevent decompression bombs - G110 protection
			limitedTarReader := &limitedReader{
				reader: tarReader,
				limit:  maxSingleFileSize,
			}

			// Copy file content with size limits
			//nolint:gosec // G110: Protected by limitedReader and size checks above
			bytesWritten, err := io.Copy(outFile, limitedTarReader)
			if err != nil {
				_ = outFile.Close()
				return fmt.Errorf("failed to copy file content for %s: %w", destPath, err)
			}
			_ = outFile.Close()

			// Update total extracted size
			totalExtracted += bytesWritten

			// Additional compression ratio check
			if header.Size > 0 && bytesWritten > header.Size*maxCompressionRatio {
				return fmt.Errorf("suspicious compression ratio for file %s (wrote %d bytes, header claimed %d)",
					header.Name, bytesWritten, header.Size)
			}

		default:
			// Skip other file types
			continue
		}
	}

	return nil
}

// validateCapsuleStructure validates that the extracted capsule follows DP-1 structure
func validateCapsuleStructure(extractDir string) (*CapsuleInfo, error) {
	// Look for playlist.json in the root
	playlistPath := filepath.Join(extractDir, "playlist.json")
	if _, err := os.Stat(playlistPath); err != nil {
		return nil, fmt.Errorf("playlist.json not found in capsule root")
	}

	// Check for assets directory (required)
	assetsPath := filepath.Join(extractDir, "assets")
	if info, err := os.Stat(assetsPath); err != nil {
		return nil, fmt.Errorf("assets/ directory not found in capsule root - it is required")
	} else if !info.IsDir() {
		return nil, fmt.Errorf("assets/ exists but is not a directory")
	}

	// Parse and validate playlist.json using the existing playlist package
	// Clean the playlist path for security (should be safe since extractDir is controlled)
	cleanPlaylistPath := filepath.Clean(playlistPath)

	// Additional validation: ensure the path is still within our extract directory
	if !strings.HasPrefix(cleanPlaylistPath, filepath.Clean(extractDir)) {
		return nil, fmt.Errorf("playlist.json path is outside extract directory")
	}

	playlistData, err := os.ReadFile(cleanPlaylistPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read playlist.json: %w", err)
	}

	// Use the playlist package to parse the JSON
	p, _, err := playlist.ParsePlaylist(string(playlistData))
	if err != nil {
		return nil, fmt.Errorf("failed to parse playlist.json: %w", err)
	}

	// Use the playlist package to validate the structure
	if err := playlist.ValidatePlaylistStructure(p); err != nil {
		return nil, fmt.Errorf("invalid playlist structure: %w", err)
	}

	info := &CapsuleInfo{
		ExtractPath:  extractDir,
		PlaylistPath: playlistPath,
		AssetsPath:   assetsPath,
		Playlist:     p,
	}

	return info, nil
}

// CleanupCapsule removes the temporary extraction directory
func CleanupCapsule(info *CapsuleInfo) error {
	if info == nil || info.ExtractPath == "" {
		return nil
	}
	return os.RemoveAll(info.ExtractPath)
}
