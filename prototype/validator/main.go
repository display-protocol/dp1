package main

import (
	"fmt"
	"os"

	"github.com/feral-file/dp-1/validator/playlist"
	"github.com/feral-file/dp-1/validator/validator"
	"github.com/spf13/cobra"
)

var rootCmd = &cobra.Command{
	Use:   "dp1-validator",
	Short: "DP-1 playlist and capsule validator",
	Long: `A validator for DP-1 playlists and capsules that can verify:
- Ed25519 signatures on playlists
- SHA256 asset integrity in capsules
- Structural compliance with DP-1 specification`,
}

var playlistCmd = &cobra.Command{
	Use:   "playlist",
	Short: "Validate a DP-1 playlist",
	Long: `Validate a DP-1 playlist by verifying its Ed25519 signature.
The playlist can be provided as a URL or base64 encoded payload.`,
	RunE: validatePlaylist,
}

var capsuleCmd = &cobra.Command{
	Use:   "capsule",
	Short: "Validate a DP-1 capsule",
	Long: `Validate a DP-1 capsule by verifying asset integrity using SHA256 hashes.
The capsule playlist must contain repro.assetsSHA256 array for verification.`,
	RunE: validateCapsule,
}

// Playlist command flags
var (
	playlistInput string
	pubkeyHex     string
)

// Capsule command flags
var (
	capsulePlaylist string
	directoryPath   string
	hashesInput     string
)

func init() {
	// Playlist command flags
	playlistCmd.Flags().StringVar(&playlistInput, "playlist", "", "Playlist URL or base64 encoded payload (required)")
	playlistCmd.Flags().StringVar(&pubkeyHex, "pubkey", "", "Ed25519 public key as hex for signature verification (required)")
	_ = playlistCmd.MarkFlagRequired("playlist")
	_ = playlistCmd.MarkFlagRequired("pubkey")

	// Capsule command flags
	capsuleCmd.Flags().StringVar(&capsulePlaylist, "playlist", "", "Capsule playlist URL or base64 encoded payload (required)")
	capsuleCmd.Flags().StringVar(&directoryPath, "path", "", "Local directory path to verify against playlist hashes")
	capsuleCmd.Flags().StringVar(&hashesInput, "hashes", "", "Array of hashes to compare (format: [a,b,c] or a:b:c or a,b,c)")
	_ = capsuleCmd.MarkFlagRequired("playlist")

	// Add commands to root
	rootCmd.AddCommand(playlistCmd)
	rootCmd.AddCommand(capsuleCmd)
}

func main() {
	if err := rootCmd.Execute(); err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}
}

func validatePlaylist(cmd *cobra.Command, args []string) error {
	fmt.Printf("🔍 Validating DP-1 playlist...\n\n")

	// Parse the playlist
	fmt.Printf("📋 Parsing playlist from input...\n")
	p, rawData, err := playlist.ParsePlaylist(playlistInput)
	if err != nil {
		return fmt.Errorf("failed to parse playlist: %w", err)
	}

	fmt.Printf("✅ Playlist parsed successfully\n")
	fmt.Printf("   - ID: %s\n", p.ID)
	fmt.Printf("   - Version: %s\n", p.DPVersion)
	fmt.Printf("   - Items: %d\n", len(p.Items))

	// Validate basic structure
	fmt.Printf("\n🏗️  Validating playlist structure...\n")
	if err := playlist.ValidatePlaylistStructure(p); err != nil {
		return fmt.Errorf("playlist structure validation failed: %w", err)
	}
	fmt.Printf("✅ Playlist structure is valid\n")

	// Check if signature exists
	if !playlist.HasSignature(p) {
		return fmt.Errorf("playlist does not contain a signature")
	}

	// Validate public key format
	fmt.Printf("\n🔑 Validating public key format...\n")
	if err := validator.ValidatePublicKey(pubkeyHex); err != nil {
		return fmt.Errorf("invalid public key: %w", err)
	}
	fmt.Printf("✅ Public key format is valid\n")

	// Validate signature format
	fmt.Printf("\n📝 Validating signature format...\n")
	if err := validator.ValidateSignatureFormat(p.Signature); err != nil {
		return fmt.Errorf("invalid signature format: %w", err)
	}
	fmt.Printf("✅ Signature format is valid\n")

	// Get signable content (playlist without signature)
	fmt.Printf("\n🔒 Preparing content for verification...\n")
	signableContent, err := playlist.GetSignableContent(rawData)
	if err != nil {
		return fmt.Errorf("failed to prepare signable content: %w", err)
	}
	fmt.Printf("✅ Signable content prepared\n")

	// Verify signature
	fmt.Printf("\n✍️  Verifying Ed25519 signature...\n")
	if err := validator.VerifyPlaylistSignature(pubkeyHex, signableContent, p.Signature); err != nil {
		return fmt.Errorf("signature verification failed: %w", err)
	}

	fmt.Printf("🎉 Playlist signature verification successful!\n")
	fmt.Printf("\n📊 Summary:\n")
	fmt.Printf("   - Playlist ID: %s\n", p.ID)
	fmt.Printf("   - DP Version: %s\n", p.DPVersion)
	fmt.Printf("   - Items: %d\n", len(p.Items))
	fmt.Printf("   - Signature: Valid ✅\n")
	fmt.Printf("   - Public Key: %s...\n", pubkeyHex[:16])

	return nil
}

func validateCapsule(cmd *cobra.Command, args []string) error {
	fmt.Printf("🗂️  Validating DP-1 capsule...\n\n")

	// Parse the playlist
	fmt.Printf("📋 Parsing capsule playlist from input...\n")
	p, _, err := playlist.ParsePlaylist(capsulePlaylist)
	if err != nil {
		return fmt.Errorf("failed to parse capsule playlist: %w", err)
	}

	fmt.Printf("✅ Capsule playlist parsed successfully\n")
	fmt.Printf("   - ID: %s\n", p.ID)
	fmt.Printf("   - Version: %s\n", p.DPVersion)
	fmt.Printf("   - Items: %d\n", len(p.Items))

	// Extract asset hashes from playlist
	fmt.Printf("\n🔍 Extracting asset hashes from playlist...\n")
	expectedHashes := playlist.ExtractAssetHashes(p)
	if len(expectedHashes) == 0 {
		return fmt.Errorf("playlist does not contain repro.assetsSHA256 hashes for verification")
	}

	fmt.Printf("✅ Found %d asset hashes in playlist\n", len(expectedHashes))
	for i, hash := range expectedHashes {
		fmt.Printf("   %d. %s...\n", i+1, hash[:16])
	}

	var verificationResult *validator.VerificationResult

	if directoryPath != "" {
		// Verify against local directory
		fmt.Printf("\n📁 Verifying assets in directory: %s\n", directoryPath)
		verificationResult, err = validator.VerifyDirectoryHashes(directoryPath, expectedHashes)
		if err != nil {
			return fmt.Errorf("directory verification failed: %w", err)
		}
	} else if hashesInput != "" {
		// Verify against provided hashes
		fmt.Printf("\n🔢 Parsing provided hashes...\n")
		providedHashes := playlist.ParseHashesString(hashesInput)
		if len(providedHashes) == 0 {
			return fmt.Errorf("no valid hashes found in input")
		}

		fmt.Printf("✅ Found %d hashes in input\n", len(providedHashes))

		// Compare the hash lists
		matched, missing, extra := compareHashLists(expectedHashes, providedHashes)

		success := len(missing) == 0 && len(extra) == 0
		verificationResult = &validator.VerificationResult{
			Success:       success,
			TotalFiles:    len(providedHashes),
			MatchedHashes: len(matched),
			MissingHashes: missing,
			ExtraHashes:   extra,
		}
	} else {
		return fmt.Errorf("either --path or --hashes must be provided for verification")
	}

	// Display results
	fmt.Printf("\n📊 Verification Results:\n")
	if verificationResult.Success {
		fmt.Printf("🎉 Asset verification successful!\n")
	} else {
		fmt.Printf("❌ Asset verification failed!\n")
	}

	fmt.Printf("   - Total files/hashes: %d\n", verificationResult.TotalFiles)
	fmt.Printf("   - Matched hashes: %d\n", verificationResult.MatchedHashes)

	if len(verificationResult.MissingHashes) > 0 {
		fmt.Printf("   - Missing hashes: %d\n", len(verificationResult.MissingHashes))
		for _, hash := range verificationResult.MissingHashes {
			fmt.Printf("     ❌ %s...\n", hash[:16])
		}
	}

	if len(verificationResult.ExtraHashes) > 0 {
		fmt.Printf("   - Extra hashes: %d\n", len(verificationResult.ExtraHashes))
		for _, hash := range verificationResult.ExtraHashes {
			fmt.Printf("     ➕ %s...\n", hash[:16])
		}
	}

	if directoryPath != "" && len(verificationResult.Results) > 0 {
		fmt.Printf("\n📂 File Details:\n")
		for _, result := range verificationResult.Results {
			if result.Error != "" {
				fmt.Printf("   ❌ %s (Error: %s)\n", result.Path, result.Error)
			} else {
				fmt.Printf("   ✅ %s (%d bytes) -> %s...\n", result.Path, result.Size, result.SHA256[:16])
			}
		}
	}

	if !verificationResult.Success {
		return fmt.Errorf("capsule verification failed")
	}

	return nil
}

// Helper function for comparing hash lists (copied from validator package for CLI use)
func compareHashLists(expected, actual []string) (matched, missing, extra []string) {
	expectedMap := make(map[string]bool)
	actualMap := make(map[string]bool)

	// Build maps for efficient lookup
	for _, hash := range expected {
		expectedMap[hash] = true
	}
	for _, hash := range actual {
		actualMap[hash] = true
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

	return matched, missing, extra
}
