package user

import (
	"bytes"
	"encoding/base64"
	"errors"
	"image/png"
	"time"

	"github.com/pquerna/otp/totp"
	"github.com/rs/zerolog/log"
)

// ------- Feature 5: device tags / display name -------
//
// This is server-side metadata only (a nickname/tags the user assigns to
// their own device record). It never touches the E2E-encrypted location
// or picture payloads, so it's safe to store and query server-side.

func (u *UserRepository) SetDisplayName(user *FMDUser, displayName string) {
	user.DisplayName = displayName
	u.UB.Save(&user)
}

func (u *UserRepository) GetDisplayName(user *FMDUser) string {
	return user.DisplayName
}

func (u *UserRepository) SetTags(user *FMDUser, tags string) {
	user.Tags = tags
	u.UB.Save(&user)
}

func (u *UserRepository) GetTags(user *FMDUser) string {
	return user.Tags
}

// ------- Feature 6: audit log -------
//
// Logs metadata about account access/actions (event name, remote IP,
// timestamp) -- never location content. Auto-prunes to the most recent
// maxAuditLogEntries per user.

const maxAuditLogEntries = 200

const (
	AuditLoginSuccess  = "login_success"
	AuditLoginFailed   = "login_failed"
	AuditCommandSent   = "command_sent"
	AuditPasswordChanged = "password_changed"
)

func (u *UserRepository) LogAuditEvent(user *FMDUser, event string, remoteIp string) {
	entry := AuditLog{
		UserID:    user.Id,
		Event:     event,
		RemoteIp:  remoteIp,
		CreatedAt: time.Now().Unix(),
	}
	u.UB.Create(&entry)
	u.pruneAuditLog(user)
}

func (u *UserRepository) pruneAuditLog(user *FMDUser) {
	var count int64
	u.UB.DB.Model(&AuditLog{}).Where("user_id = ?", user.Id).Count(&count)

	if count <= maxAuditLogEntries {
		return
	}

	var oldest []AuditLog
	toDelete := int(count) - maxAuditLogEntries
	result := u.UB.DB.
		Where("user_id = ?", user.Id).
		Order("created_at ASC, id ASC").
		Limit(toDelete).
		Find(&oldest)

	if result.Error != nil || len(oldest) == 0 {
		return
	}

	var ids []uint64
	for _, entry := range oldest {
		ids = append(ids, entry.Id)
	}
	u.UB.DB.Where("id IN ?", ids).Delete(&AuditLog{})
}

func (u *UserRepository) GetAuditLog(user *FMDUser) []AuditLog {
	var entries []AuditLog
	u.UB.DB.Where("user_id = ?", user.Id).Order("created_at DESC, id DESC").Find(&entries)
	return entries
}

// ------- Feature 7: TOTP (2FA) for login -------

const totpIssuer = "FMD Server"

var ErrTotpAlreadyEnabled = errors.New("2FA is already enabled")
var ErrTotpNotEnabled = errors.New("2FA is not enabled")
var ErrTotpNoPendingSetup = errors.New("no pending 2FA setup, call setup first")
var ErrTotpInvalidCode = errors.New("invalid 2FA code")

// BeginTotpSetup generates a new TOTP secret and stores it (unconfirmed --
// TotpEnabled stays false until ConfirmTotpSetup succeeds), then returns a
// PNG QR code (base64-encoded) that the user scans with an authenticator app.
func (u *UserRepository) BeginTotpSetup(user *FMDUser) (secret string, qrCodePngBase64 string, err error) {
	if user.TotpEnabled {
		return "", "", ErrTotpAlreadyEnabled
	}

	key, err := totp.Generate(totp.GenerateOpts{
		Issuer:      totpIssuer,
		AccountName: user.Username,
	})
	if err != nil {
		return "", "", err
	}

	user.TotpSecret = key.Secret()
	u.UB.Save(&user)

	img, err := key.Image(256, 256)
	if err != nil {
		// The secret itself is still usable for manual entry even if the
		// QR image generation fails, so don't treat this as fatal.
		log.Warn().Err(err).Str("user", user.Username).Msg("failed to render TOTP QR code")
		return key.Secret(), "", nil
	}

	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		return key.Secret(), "", nil
	}

	return key.Secret(), base64.StdEncoding.EncodeToString(buf.Bytes()), nil
}

// ConfirmTotpSetup verifies a code against the pending secret from
// BeginTotpSetup and, if valid, enables 2FA for the account.
func (u *UserRepository) ConfirmTotpSetup(user *FMDUser, code string) error {
	if user.TotpSecret == "" {
		return ErrTotpNoPendingSetup
	}
	if user.TotpEnabled {
		return ErrTotpAlreadyEnabled
	}

	if !totp.Validate(code, user.TotpSecret) {
		return ErrTotpInvalidCode
	}

	user.TotpEnabled = true
	u.UB.Save(&user)
	return nil
}

// ValidateTotpCode checks a login-time code against the enabled secret.
func (u *UserRepository) ValidateTotpCode(user *FMDUser, code string) bool {
	if !user.TotpEnabled || user.TotpSecret == "" {
		return false
	}
	return totp.Validate(code, user.TotpSecret)
}

func (u *UserRepository) DisableTotp(user *FMDUser) error {
	if !user.TotpEnabled {
		return ErrTotpNotEnabled
	}
	user.TotpEnabled = false
	user.TotpSecret = ""
	u.UB.Save(&user)
	return nil
}

func (u *UserRepository) GetTotpStatus(user *FMDUser) bool {
	return user.TotpEnabled
}
