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
	Long: `Validate a DP-1 capsule (.dp1c file) by extracting it and verifying asset integrity using SHA256 hashes.

The capsule file must be a valid .dp1c archive (tar+zstd) containing:
- playlist.json in the root
- assets/ directory with the actual files (required)

Usage modes:
1. Capsule only: --path capsule.dp1c (uses hashes from playlist's repro.assetsSHA256)
2. Capsule with override: --path capsule.dp1c --hashes hash1,hash2,... (provided hashes override playlist hashes)

The --path argument must point to a .dp1c file. The --hashes argument is optional and will override
any hashes found in the playlist's repro.assetsSHA256 blocks.`,
	RunE: validateCapsule,
}

// Playlist command flags
var (
	playlistInput string
	pubkeyHex     string
)

// Capsule command flags
var (
	capsulePath string
	hashesInput string
)

func init() {
	// Playlist command flags
	playlistCmd.Flags().StringVar(&playlistInput, "playlist", "", "Playlist URL or base64 encoded payload (required)")
	playlistCmd.Flags().StringVar(&pubkeyHex, "pubkey", "", "Ed25519 public key as hex for signature verification (required)")
	_ = playlistCmd.MarkFlagRequired("playlist")
	_ = playlistCmd.MarkFlagRequired("pubkey")

	// Capsule command flags
	capsuleCmd.Flags().StringVar(&capsulePath, "path", "", "Path to .dp1c capsule file (required)")
	capsuleCmd.Flags().StringVar(&hashesInput, "hashes", "", "Array of hashes to compare (format: [a,b,c] or a:b:c or a,b,c) - overrides playlist hashes")
	_ = capsuleCmd.MarkFlagRequired("path")

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
	p, _, err := playlist.ParsePlaylist(playlistInput)
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
	signableContent, err := playlist.CanonicalizePlaylist(p, true)
	if err != nil {
		return fmt.Errorf("failed to prepare signable content: %w", err)
	}
	fmt.Printf("✅ Signable content prepared\n")

	// Verify signature
	fmt.Printf("\n✍️  Verifying Ed25519 signature...\n")
	if err := validator.VerifySignature(pubkeyHex, signableContent, p.Signature); err != nil {
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

// safeHashPreview returns a preview of the hash, handling short hashes gracefully
func safeHashPreview(hash string) string {
	if len(hash) <= 16 {
		return hash
	}
	return hash[:16] + "..."
}

func validateCapsule(cmd *cobra.Command, args []string) error {
	fmt.Printf("🗂️  Validating DP-1 capsule...\n\n")

	// Extract the capsule
	fmt.Printf("📦 Extracting capsule from: %s\n", capsulePath)
	capsuleInfo, err := validator.ExtractCapsule(capsulePath)
	if err != nil {
		return fmt.Errorf("failed to extract capsule: %w", err)
	}
	defer func() { _ = validator.CleanupCapsule(capsuleInfo) }()

	fmt.Printf("✅ Capsule extracted successfully\n")
	fmt.Printf("   - Extract path: %s\n", capsuleInfo.ExtractPath)
	if capsuleInfo.AssetsPath != "" {
		fmt.Printf("   - Assets found: %s\n", capsuleInfo.AssetsPath)
	}

	// Display playlist information
	fmt.Printf("\n📋 Playlist information:\n")
	fmt.Printf("   - DP Version: %s\n", capsuleInfo.Playlist.DPVersion)
	fmt.Printf("   - ID: %s\n", capsuleInfo.Playlist.ID)
	fmt.Printf("   - Items: %d\n", len(capsuleInfo.Playlist.Items))

	// Extract asset hashes from playlist
	fmt.Printf("\n🔍 Extracting asset hashes from playlist...\n")
	var expectedHashes []string
	if hashesInput != "" {
		// Use provided hashes if specified
		fmt.Printf("🔄 Using provided hashes instead of playlist hashes...\n")
		providedHashes := validator.ExtractHashesFromString(hashesInput)
		if len(providedHashes) == 0 {
			return fmt.Errorf("no valid hashes found in --hashes input")
		}
		expectedHashes = providedHashes
		fmt.Printf("✅ Using %d hashes from --hashes parameter\n", len(expectedHashes))
	} else {
		// Extract hashes from playlist using the existing playlist package function
		expectedHashes = playlist.ExtractAssetHashes(capsuleInfo.Playlist)
		if len(expectedHashes) == 0 {
			return fmt.Errorf("no asset hashes found in playlist repro.assetsSHA256. Use --hashes to provide hashes manually")
		}
		fmt.Printf("✅ Found %d asset hashes in playlist\n", len(expectedHashes))
	}

	for i, hash := range expectedHashes {
		fmt.Printf("   %d. %s\n", i+1, safeHashPreview(hash))
	}

	// Determine directory to verify (prefer assets directory, fallback to extract root)
	verifyDir := capsuleInfo.ExtractPath
	if capsuleInfo.AssetsPath != "" {
		verifyDir = capsuleInfo.AssetsPath
	}

	// Verify hashes against extracted files
	fmt.Printf("\n📁 Verifying assets in: %s\n", verifyDir)
	verificationResult, err := validator.VerifyDirectoryHashes(verifyDir, expectedHashes)
	if err != nil {
		return fmt.Errorf("asset verification failed: %w", err)
	}

	// Display results
	fmt.Printf("\n📊 Verification Results:\n")
	if verificationResult.Success {
		fmt.Printf("🎉 Capsule verification successful!\n")
	} else {
		fmt.Printf("❌ Capsule verification failed!\n")
	}

	fmt.Printf("   - Total files: %d\n", verificationResult.TotalFiles)
	fmt.Printf("   - Matched hashes: %d\n", verificationResult.MatchedHashes)

	if len(verificationResult.MissingHashes) > 0 {
		fmt.Printf("   - Missing hashes: %d\n", len(verificationResult.MissingHashes))
		for _, hash := range verificationResult.MissingHashes {
			fmt.Printf("     ❌ %s\n", safeHashPreview(hash))
		}
	}

	if len(verificationResult.ExtraHashes) > 0 {
		fmt.Printf("   - Extra hashes: %d\n", len(verificationResult.ExtraHashes))
		for _, hash := range verificationResult.ExtraHashes {
			fmt.Printf("     ➕ %s\n", safeHashPreview(hash))
		}
	}

	if len(verificationResult.Results) > 0 {
		fmt.Printf("\n📂 File Details:\n")
		for _, result := range verificationResult.Results {
			if result.Error != "" {
				fmt.Printf("   ❌ %s (Error: %s)\n", result.Path, result.Error)
			} else {
				fmt.Printf("   ✅ %s (%d bytes) -> %s\n", result.Path, result.Size, safeHashPreview(result.SHA256))
			}
		}
	}

	if !verificationResult.Success {
		return fmt.Errorf("capsule verification failed")
	}

	return nil
}
