# DP-1 Validator

[![Build Status](https://img.shields.io/github/actions/workflow/status/feral-file/dp-1/test-validator.yaml?branch=main&label=build%20status&logo=github)](https://github.com/feral-file/dp-1/actions/workflows/test-validator.yaml)
[![Linter](https://img.shields.io/github/actions/workflow/status/feral-file/dp-1/lint-validator.yaml?branch=main&label=linter&logo=github)](https://github.com/feral-file/dp-1/actions/workflows/lint-validator.yaml)
[![Code Coverage](https://img.shields.io/codecov/c/github/feral-file/dp-1/main?label=code%20coverage&logo=codecov)](https://codecov.io/gh/feral-file/dp-1)

A command-line validator for DP-1 playlists and capsules that can verify Ed25519 signatures and SHA256 asset integrity according to the DP-1 specification.

## Features

- **Playlist Validation**: Verify Ed25519 signatures on DP-1 playlists
- **Capsule Validation**: Extract and verify SHA256 asset integrity in DP-1 capsules (.dp1c files)
- **Multiple Input Formats**: Support for URLs and base64 encoded payloads for playlists
- **Capsule Extraction**: Automatic tar+zstd extraction to temporary directories
- **Asset Verification**: Compare extracted files against expected hashes from playlist or CLI
- **Structural Validation**: Ensure compliance with DP-1 specification

## Installation

```bash
# Clone and build
git clone <repository>
cd prototype/validator
go mod tidy
go build -o dp1-validator .
```

## Usage

### Playlist Validation

Validate a DP-1 playlist by verifying its Ed25519 signature:

```bash
# Validate playlist from URL
./dp1-validator playlist \
  --playlist "https://example.com/playlist.json" \
  --pubkey "a1b2c3d4e5f6..."

# Validate playlist from base64 encoded data
./dp1-validator playlist \
  --playlist "eyJkcFZlcnNpb24iOiIxLjAuMCIsLi4u" \
  --pubkey "a1b2c3d4e5f6..."
```

**Required flags:**
- `--playlist`: Playlist URL or base64 encoded payload
- `--pubkey`: Ed25519 public key as hex string for signature verification

### Capsule Validation

Validate a DP-1 capsule (.dp1c file) by extracting it and verifying asset integrity using SHA256 hashes:

```bash
# Validate capsule using hashes from playlist's repro.assetsSHA256
./dp1-validator capsule \
  --path "artwork.dp1c"

# Validate capsule with custom hash list (overrides playlist hashes)
./dp1-validator capsule \
  --path "artwork.dp1c" \
  --hashes "hash1,hash2,hash3"

# Alternative hash formats
./dp1-validator capsule \
  --path "artwork.dp1c" \
  --hashes "[hash1,hash2,hash3]"

./dp1-validator capsule \
  --path "artwork.dp1c" \
  --hashes "hash1:hash2:hash3"
```

**Required flags:**
- `--path`: Path to .dp1c capsule file

**Optional flags:**
- `--hashes`: Array of hashes to compare (overrides playlist hashes; supports multiple formats)

**Capsule Requirements:**
- File must have `.dp1c` extension
- Must be a valid tar+zstd archive
- Must contain `playlist.json` in the root
- Must contain `assets/` directory with artwork files

## Library Usage

The validator can also be used as a Go library:

```go
package main

import (
    "fmt"
    "github.com/feral-file/dp-1/validator/validator"
)

func main() {
    // Verify playlist signature
    err := validator.VerifyPlaylistSignature(pubkeyHex, signableContent, signature)
    if err != nil {
        fmt.Printf("Signature verification failed: %v\n", err)
    }

    // Verify directory hashes
    result, err := validator.VerifyDirectoryHashes("/path/to/dir", expectedHashes)
    if err != nil {
        fmt.Printf("Directory verification failed: %v\n", err)
    }
    
    fmt.Printf("Verification successful: %v\n", result.Success)
}
```

## Components

### Core Files

- **`main.go`**: CLI application with subcommands for playlist and capsule validation
- **`playlist/playlist.go`**: Playlist parsing, canonicalization, and utility functions
- **`validator/ed25519.go`**: Ed25519 signature verification functionality
- **`validator/sha256.go`**: SHA256 hash computation and verification
- **`validator/capsule.go`**: DP-1 capsule extraction and validation
- **`cdp/cdp.go`**: Placeholder for Chrome DevTools Protocol integration (future)

### Key Functions

#### Playlist Operations
- `ParsePlaylist()`: Parse playlist from URL or base64
- `CanonicalizePlaylist()`: Convert to canonical JSON form
- `GetPlaylistHash()`: Generate content hash for duplicate detection
- `ValidatePlaylistStructure()`: Ensure DP-1 compliance

#### Signature Verification
- `validator.VerifyPlaylistSignature()`: Verify Ed25519 signatures
- `validator.ValidatePublicKey()`: Validate public key format
- `validator.ValidateSignatureFormat()`: Validate signature format

#### Hash Verification
- `validator.ComputeDirectoryHashes()`: Calculate SHA256 for all files
- `validator.VerifyDirectoryHashes()`: Compare computed vs expected hashes
- `validator.ValidateHashFormat()`: Validate SHA256 hash format

#### Capsule Operations
- `validator.ExtractCapsule()`: Extract .dp1c files to temporary directories
- `validator.ExtractAssetHashesFromPlaylist()`: Extract hashes from playlist repro blocks
- `validator.CleanupCapsule()`: Remove temporary extraction directories

## Examples

### Valid DP-1 Playlist Structure

```json
{
  "dpVersion": "1.0.0",
  "id": "385f79b6-a45f-4c1c-8080-e93a192adccc",
  "slug": "summer-mix-01",
  "created": "2025-06-03T17:01:00Z",
  "defaults": {
    "display": {
      "scaling": "fit",
      "background": "#000000",
      "margin": "5%"
    },
    "license": "open",
    "duration": 300
  },
  "items": [
    {
      "id": "item-1",
      "source": "https://example.com/artwork.html",
      "repro": {
        "assetsSHA256": [
          "abcdef1234567890...",
          "fedcba0987654321..."
        ]
      }
    }
  ],
  "signature": "ed25519:0x..."
}
```

### Error Handling

The validator provides detailed error messages for common issues:

- **Invalid playlist structure**: Missing required fields, invalid timestamps
- **Signature verification failures**: Invalid public keys, malformed signatures
- **Hash mismatches**: Missing files, extra files, corrupted content
- **Network errors**: Failed URL fetches, timeout issues

## Future Enhancements

- **Chrome DevTools Integration**: First-frame capture and verification
- **Batch Validation**: Process multiple playlists/capsules
- **JSON Schema Validation**: Comprehensive structural validation  
- **Performance Optimization**: Parallel hash computation
- **Engine Layer Support**: Validation of engine-specific capsule layers

## Dependencies

- `github.com/spf13/cobra`: CLI framework
- `github.com/klauspost/compress`: Zstandard compression for capsule extraction
- `golang.org/x/crypto`: Ed25519 cryptography
- Standard Go libraries for HTTP, JSON, tar, and file operations

## Contributing

1. Ensure all tests pass: `go test ./...`
2. Follow Go conventions and add appropriate documentation
3. Update this README for new features

## License

This project follows the DP-1 specification governance model.
