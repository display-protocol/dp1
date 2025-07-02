package validator

import (
	"crypto/ed25519"
	"encoding/hex"
	"strings"
	"testing"
)

// Test vectors for Ed25519 validation
var (
	validPublicKeyHex = "f6b7d5f8e9c0b8d7a8b5c2d9e0f3a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8"
	validSignatureHex = "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
	testContent       = []byte("test content for signing")
)

func TestVerifyPlaylistSignature(t *testing.T) {
	// Generate a real key pair for testing
	privKey, pubKey, err := GenerateKeyPair()
	if err != nil {
		t.Fatalf("Failed to generate key pair: %v", err)
	}

	// Sign test content
	signature, err := SignContent(privKey, testContent)
	if err != nil {
		t.Fatalf("Failed to sign content: %v", err)
	}

	tests := []struct {
		name           string
		pubkey         string
		content        []byte
		signature      string
		expectError    bool
		errorSubstring string
	}{
		{
			name:        "Valid signature",
			pubkey:      pubKey,
			content:     testContent,
			signature:   signature,
			expectError: false,
		},
		{
			name:           "Invalid public key - too short",
			pubkey:         "abcdef",
			content:        testContent,
			signature:      signature,
			expectError:    true,
			errorSubstring: "invalid public key",
		},
		{
			name:           "Invalid public key - not hex",
			pubkey:         "not-hex-characters-zzz",
			content:        testContent,
			signature:      signature,
			expectError:    true,
			errorSubstring: "invalid public key",
		},
		{
			name:           "Invalid signature format - missing prefix",
			pubkey:         pubKey,
			content:        testContent,
			signature:      "1234567890abcdef",
			expectError:    true,
			errorSubstring: "invalid signature format",
		},
		{
			name:           "Invalid signature format - empty",
			pubkey:         pubKey,
			content:        testContent,
			signature:      "",
			expectError:    true,
			errorSubstring: "invalid signature format",
		},
		{
			name:           "Wrong content",
			pubkey:         pubKey,
			content:        []byte("different content"),
			signature:      signature,
			expectError:    true,
			errorSubstring: "signature verification failed",
		},
		{
			name:           "Wrong public key",
			pubkey:         validPublicKeyHex,
			content:        testContent,
			signature:      signature,
			expectError:    true,
			errorSubstring: "signature verification failed",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := VerifyPlaylistSignature(tt.pubkey, tt.content, tt.signature)

			if tt.expectError {
				if err == nil {
					t.Errorf("Expected error but got none")
					return
				}
				if tt.errorSubstring != "" && !strings.Contains(err.Error(), tt.errorSubstring) {
					t.Errorf("Expected error containing %q, got %q", tt.errorSubstring, err.Error())
				}
			} else {
				if err != nil {
					t.Errorf("Unexpected error: %v", err)
				}
			}
		})
	}
}

func TestParsePublicKey(t *testing.T) {
	tests := []struct {
		name        string
		input       string
		expectError bool
		errorMsg    string
	}{
		{
			name:        "Valid hex key",
			input:       validPublicKeyHex,
			expectError: false,
		},
		{
			name:        "Valid hex key with 0x prefix",
			input:       "0x" + validPublicKeyHex,
			expectError: false,
		},
		{
			name:        "Too short",
			input:       "abcdef",
			expectError: true,
			errorMsg:    "invalid public key length",
		},
		{
			name:        "Too long",
			input:       validPublicKeyHex + "extra",
			expectError: true,
			errorMsg:    "failed to decode hex public key",
		},
		{
			name:        "Invalid hex characters",
			input:       strings.ReplaceAll(validPublicKeyHex, "a", "z"),
			expectError: true,
			errorMsg:    "failed to decode hex public key",
		},
		{
			name:        "Empty string",
			input:       "",
			expectError: true,
			errorMsg:    "invalid public key length",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			key, err := parsePublicKey(tt.input)

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
					return
				}
				if len(key) != ed25519.PublicKeySize {
					t.Errorf("Expected key length %d, got %d", ed25519.PublicKeySize, len(key))
				}
			}
		})
	}
}

func TestParseSignature(t *testing.T) {
	tests := []struct {
		name        string
		input       string
		expectError bool
		errorMsg    string
	}{
		{
			name:        "Valid signature",
			input:       "ed25519:" + validSignatureHex,
			expectError: false,
		},
		{
			name:        "Valid signature with 0x prefix",
			input:       "ed25519:0x" + validSignatureHex,
			expectError: false,
		},
		{
			name:        "Missing ed25519 prefix",
			input:       validSignatureHex,
			expectError: true,
			errorMsg:    "signature must start with 'ed25519:'",
		},
		{
			name:        "Empty signature",
			input:       "",
			expectError: true,
			errorMsg:    "signature is empty",
		},
		{
			name:        "Wrong prefix",
			input:       "rsa:" + validSignatureHex,
			expectError: true,
			errorMsg:    "signature must start with 'ed25519:'",
		},
		{
			name:        "Too short hex",
			input:       "ed25519:abcdef",
			expectError: true,
			errorMsg:    "invalid signature length",
		},
		{
			name:        "Too long hex",
			input:       "ed25519:" + validSignatureHex + "extra",
			expectError: true,
			errorMsg:    "failed to decode hex signature",
		},
		{
			name:        "Invalid hex characters",
			input:       "ed25519:" + strings.ReplaceAll(validSignatureHex, "a", "z"),
			expectError: true,
			errorMsg:    "failed to decode hex signature",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			sig, err := parseSignature(tt.input)

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
					return
				}
				if len(sig) != ed25519.SignatureSize {
					t.Errorf("Expected signature length %d, got %d", ed25519.SignatureSize, len(sig))
				}
			}
		})
	}
}

func TestValidatePublicKey(t *testing.T) {
	tests := []struct {
		name        string
		input       string
		expectError bool
	}{
		{
			name:        "Valid key",
			input:       validPublicKeyHex,
			expectError: false,
		},
		{
			name:        "Valid key with prefix",
			input:       "0x" + validPublicKeyHex,
			expectError: false,
		},
		{
			name:        "Invalid key",
			input:       "invalid",
			expectError: true,
		},
		{
			name:        "Empty key",
			input:       "",
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidatePublicKey(tt.input)

			if tt.expectError {
				if err == nil {
					t.Errorf("Expected error but got none")
				}
			} else {
				if err != nil {
					t.Errorf("Unexpected error: %v", err)
				}
			}
		})
	}
}

func TestValidateSignatureFormat(t *testing.T) {
	tests := []struct {
		name        string
		input       string
		expectError bool
	}{
		{
			name:        "Valid format",
			input:       "ed25519:" + validSignatureHex,
			expectError: false,
		},
		{
			name:        "Invalid format",
			input:       "invalid",
			expectError: true,
		},
		{
			name:        "Empty signature",
			input:       "",
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateSignatureFormat(tt.input)

			if tt.expectError {
				if err == nil {
					t.Errorf("Expected error but got none")
				}
			} else {
				if err != nil {
					t.Errorf("Unexpected error: %v", err)
				}
			}
		})
	}
}

func TestGenerateKeyPair(t *testing.T) {
	privKey, pubKey, err := GenerateKeyPair()
	if err != nil {
		t.Errorf("Unexpected error: %v", err)
		return
	}

	// Check that keys are hex strings of correct length
	if len(privKey) != ed25519.PrivateKeySize*2 {
		t.Errorf("Expected private key hex length %d, got %d", ed25519.PrivateKeySize*2, len(privKey))
	}

	if len(pubKey) != ed25519.PublicKeySize*2 {
		t.Errorf("Expected public key hex length %d, got %d", ed25519.PublicKeySize*2, len(pubKey))
	}

	// Validate that keys are valid hex
	if _, err := hex.DecodeString(privKey); err != nil {
		t.Errorf("Private key is not valid hex: %v", err)
	}

	if _, err := hex.DecodeString(pubKey); err != nil {
		t.Errorf("Public key is not valid hex: %v", err)
	}

	// Test that generated keys can be used for signing and verification
	testData := []byte("test data")
	signature, err := SignContent(privKey, testData)
	if err != nil {
		t.Errorf("Failed to sign with generated key: %v", err)
		return
	}

	if err := VerifyPlaylistSignature(pubKey, testData, signature); err != nil {
		t.Errorf("Failed to verify with generated key: %v", err)
	}
}

func TestSignContent(t *testing.T) {
	// Generate key pair for testing
	privKey, pubKey, err := GenerateKeyPair()
	if err != nil {
		t.Fatalf("Failed to generate key pair: %v", err)
	}

	tests := []struct {
		name        string
		privKey     string
		content     []byte
		expectError bool
		errorMsg    string
	}{
		{
			name:        "Valid signing",
			privKey:     privKey,
			content:     testContent,
			expectError: false,
		},
		{
			name:        "Invalid private key - too short",
			privKey:     "abcdef",
			content:     testContent,
			expectError: true,
			errorMsg:    "invalid private key length",
		},
		{
			name:        "Invalid private key - not hex",
			privKey:     "not-hex-zzz",
			content:     testContent,
			expectError: true,
			errorMsg:    "failed to decode private key",
		},
		{
			name:        "Private key with 0x prefix",
			privKey:     "0x" + privKey,
			content:     testContent,
			expectError: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			signature, err := SignContent(tt.privKey, tt.content)

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
					return
				}

				// Validate signature format
				if !strings.HasPrefix(signature, "ed25519:") {
					t.Errorf("Signature should start with 'ed25519:'")
				}

				// Verify the signature works
				if err := VerifyPlaylistSignature(pubKey, tt.content, signature); err != nil {
					t.Errorf("Generated signature failed verification: %v", err)
				}
			}
		})
	}
}

func TestSignAndVerifyEndToEnd(t *testing.T) {
	// Test multiple rounds of signing and verification
	for i := 0; i < 10; i++ {
		// Generate new key pair
		privKey, pubKey, err := GenerateKeyPair()
		if err != nil {
			t.Errorf("Round %d: Failed to generate key pair: %v", i, err)
			continue
		}

		// Create test content
		content := []byte("test content round " + string(rune(i)))

		// Sign content
		signature, err := SignContent(privKey, content)
		if err != nil {
			t.Errorf("Round %d: Failed to sign content: %v", i, err)
			continue
		}

		// Verify signature
		if err := VerifyPlaylistSignature(pubKey, content, signature); err != nil {
			t.Errorf("Round %d: Failed to verify signature: %v", i, err)
		}

		// Verify that different content fails
		if err := VerifyPlaylistSignature(pubKey, []byte("different content"), signature); err == nil {
			t.Errorf("Round %d: Verification should have failed for different content", i)
		}
	}
}

func TestHashingConsistency(t *testing.T) {
	// Test that the same content always produces the same hash
	content := []byte("consistent test content")

	// Generate key pair
	privKey, _, err := GenerateKeyPair()
	if err != nil {
		t.Fatalf("Failed to generate key pair: %v", err)
	}

	// Sign the same content multiple times
	signatures := make([]string, 5)
	for i := 0; i < 5; i++ {
		sig, err := SignContent(privKey, content)
		if err != nil {
			t.Errorf("Failed to sign content round %d: %v", i, err)
			continue
		}
		signatures[i] = sig
	}

	// All signatures should be identical (deterministic signing)
	for i := 1; i < len(signatures); i++ {
		if signatures[0] != signatures[i] {
			t.Errorf("Signatures should be deterministic, but got different results")
			break
		}
	}
}

// Benchmark tests
func BenchmarkGenerateKeyPair(b *testing.B) {
	for i := 0; i < b.N; i++ {
		_, _, _ = GenerateKeyPair()
	}
}

func BenchmarkSignContent(b *testing.B) {
	privKey, _, err := GenerateKeyPair()
	if err != nil {
		b.Fatalf("Failed to generate key pair: %v", err)
	}

	content := []byte("benchmark test content")

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, _ = SignContent(privKey, content)
	}
}

func BenchmarkVerifyPlaylistSignature(b *testing.B) {
	privKey, pubKey, err := GenerateKeyPair()
	if err != nil {
		b.Fatalf("Failed to generate key pair: %v", err)
	}

	content := []byte("benchmark test content")
	signature, err := SignContent(privKey, content)
	if err != nil {
		b.Fatalf("Failed to sign content: %v", err)
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = VerifyPlaylistSignature(pubKey, content, signature)
	}
}

func BenchmarkParsePublicKey(b *testing.B) {
	_, pubKey, err := GenerateKeyPair()
	if err != nil {
		b.Fatalf("Failed to generate key pair: %v", err)
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, _ = parsePublicKey(pubKey)
	}
}

func BenchmarkParseSignature(b *testing.B) {
	signature := "ed25519:" + validSignatureHex

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, _ = parseSignature(signature)
	}
}
