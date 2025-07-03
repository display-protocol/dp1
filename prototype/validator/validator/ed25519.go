package validator

import (
	"crypto/ed25519"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"strings"
)

// VerifySignature verifies the Ed25519 signature of raw content
// pubkeyHex: Ed25519 public key as hex string
// raw: The content that was signed
// signature: The signature from the playlist in format "ed25519:<hex>"
func VerifySignature(pubkeyHex string, raw []byte, signature string) error {
	// Parse public key
	pubkey, err := parsePublicKey(pubkeyHex)
	if err != nil {
		return fmt.Errorf("invalid public key: %w", err)
	}

	// Parse signature
	sigBytes, err := parseSignature(signature)
	if err != nil {
		return fmt.Errorf("invalid signature format: %w", err)
	}

	// Hash the content using SHA-256
	hash := sha256.Sum256(raw)

	// Verify the signature
	if !ed25519.Verify(pubkey, hash[:], sigBytes) {
		return fmt.Errorf("signature verification failed")
	}

	return nil
}

// parsePublicKey parses a hex-encoded Ed25519 public key
func parsePublicKey(pubkeyHex string) (ed25519.PublicKey, error) {
	// Remove any "0x" prefix
	pubkeyHex = strings.TrimPrefix(pubkeyHex, "0x")

	pubkeyBytes, err := hex.DecodeString(pubkeyHex)
	if err != nil {
		return nil, fmt.Errorf("failed to decode hex public key: %w", err)
	}

	if len(pubkeyBytes) != ed25519.PublicKeySize {
		return nil, fmt.Errorf("invalid public key length: expected %d bytes, got %d",
			ed25519.PublicKeySize, len(pubkeyBytes))
	}

	return ed25519.PublicKey(pubkeyBytes), nil
}

// parseSignature parses a DP-1 signature in format "ed25519:<hex>"
func parseSignature(signature string) ([]byte, error) {
	if signature == "" {
		return nil, fmt.Errorf("signature is empty")
	}

	// Check for proper format
	if !strings.HasPrefix(signature, "ed25519:") {
		return nil, fmt.Errorf("signature must start with 'ed25519:'")
	}

	// Extract hex part
	hexSig := strings.TrimPrefix(signature, "ed25519:")

	// Remove "0x" prefix if present
	hexSig = strings.TrimPrefix(hexSig, "0x")

	sigBytes, err := hex.DecodeString(hexSig)
	if err != nil {
		return nil, fmt.Errorf("failed to decode hex signature: %w", err)
	}

	if len(sigBytes) != ed25519.SignatureSize {
		return nil, fmt.Errorf("invalid signature length: expected %d bytes, got %d",
			ed25519.SignatureSize, len(sigBytes))
	}

	return sigBytes, nil
}

// ValidatePublicKey validates that a hex string is a valid Ed25519 public key
func ValidatePublicKey(pubkeyHex string) error {
	_, err := parsePublicKey(pubkeyHex)
	return err
}

// ValidateSignatureFormat validates that a signature string is in the correct DP-1 format
func ValidateSignatureFormat(signature string) error {
	_, err := parseSignature(signature)
	return err
}

// GenerateKeyPair generates a new Ed25519 key pair
// Returns (privateKeyHex, publicKeyHex, error)
func GenerateKeyPair() (string, string, error) {
	pubkey, privkey, err := ed25519.GenerateKey(nil)
	if err != nil {
		return "", "", err
	}

	privkeyHex := hex.EncodeToString(privkey)
	pubkeyHex := hex.EncodeToString(pubkey)

	return privkeyHex, pubkeyHex, nil
}

// Sign hashes the raw content and signs it with a private key
// Returns signature in DP-1 format "ed25519:<hex>"
func Sign(privkeyHex string, raw []byte) (string, error) {
	// Parse private key
	privkeyBytes, err := hex.DecodeString(strings.TrimPrefix(privkeyHex, "0x"))
	if err != nil {
		return "", fmt.Errorf("failed to decode private key: %w", err)
	}

	if len(privkeyBytes) != ed25519.PrivateKeySize {
		return "", fmt.Errorf("invalid private key length: expected %d bytes, got %d",
			ed25519.PrivateKeySize, len(privkeyBytes))
	}

	privkey := ed25519.PrivateKey(privkeyBytes)

	// Hash the content
	hash := sha256.Sum256(raw)

	// Sign the hash
	signature := ed25519.Sign(privkey, hash[:])

	return fmt.Sprintf("ed25519:%x", signature), nil
}
