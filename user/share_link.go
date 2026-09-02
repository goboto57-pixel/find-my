package user

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"time"
)

// Feature 3: time-limited public share links.
//
// The server never sees plaintext location data here either: the web
// client re-encrypts a single location snapshot with a fresh, random AES
// key before uploading it as EncryptedPayload, and that key is embedded
// only in the share URL's fragment (never sent to the server). This
// repository just stores/serves the resulting opaque blob and enforces
// expiry + a per-user cap on active links.

const maxActiveShareLinks = 20

var ErrShareLinkNotFound = errors.New("share link not found or expired")

func generateShareToken() (string, error) {
	b := make([]byte, 24)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

// CreateShareLink stores an owner-encrypted payload and returns a random
// token to hand back to the owner as part of the share URL.
func (u *UserRepository) CreateShareLink(
	user *FMDUser,
	encryptedPayload string,
	durationSeconds int64,
) (token string, expiresAt int64, err error) {
	u.pruneExpiredShareLinks(user)

	var count int64
	u.UB.DB.Model(&SharedLocation{}).
		Where("user_id = ? AND expires_at > ?", user.Id, time.Now().Unix()).
		Count(&count)
	if count >= maxActiveShareLinks {
		return "", 0, errors.New("too many active share links; revoke one first")
	}

	token, err = generateShareToken()
	if err != nil {
		return "", 0, err
	}

	now := time.Now().Unix()
	expiresAt = now + durationSeconds

	entry := SharedLocation{
		UserID:           user.Id,
		Token:            token,
		EncryptedPayload: encryptedPayload,
		ExpiresAt:        expiresAt,
		CreatedAt:        now,
	}
	if result := u.UB.DB.Create(&entry); result.Error != nil {
		return "", 0, result.Error
	}

	return token, expiresAt, nil
}

// GetSharedLocation is the public, unauthenticated lookup used by the share
// page. It intentionally takes no access token -- the random token itself
// is the only credential, exactly like the design of Signal/Bitwarden Send
// links, and the decryption key never left the owner's browser.
func (u *UserRepository) GetSharedLocation(token string) (encryptedPayload string, expiresAt int64, err error) {
	var entry SharedLocation
	result := u.UB.DB.Where("token = ?", token).First(&entry)
	if result.Error != nil {
		return "", 0, ErrShareLinkNotFound
	}
	if entry.ExpiresAt <= time.Now().Unix() {
		return "", 0, ErrShareLinkNotFound
	}
	return entry.EncryptedPayload, entry.ExpiresAt, nil
}

// ListShareLinks returns the owner's active (non-expired) share links, so
// they can see/revoke what's currently shared. Never returns the payload
// itself, only metadata.
func (u *UserRepository) ListShareLinks(user *FMDUser) []SharedLocation {
	var entries []SharedLocation
	u.UB.DB.
		Where("user_id = ? AND expires_at > ?", user.Id, time.Now().Unix()).
		Order("created_at DESC").
		Find(&entries)
	return entries
}

func (u *UserRepository) RevokeShareLink(user *FMDUser, token string) error {
	result := u.UB.DB.Where("user_id = ? AND token = ?", user.Id, token).Delete(&SharedLocation{})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return ErrShareLinkNotFound
	}
	return nil
}

func (u *UserRepository) pruneExpiredShareLinks(user *FMDUser) {
	u.UB.DB.Where("user_id = ? AND expires_at <= ?", user.Id, time.Now().Unix()).
		Delete(&SharedLocation{})
}
