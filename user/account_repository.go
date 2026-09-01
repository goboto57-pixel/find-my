package user

import (
	"errors"
	"regexp"
	"time"

	"github.com/rs/zerolog/log"
)

// accountTokenNamespace prefixes the "username" stored on an Account's
// AccessController token, so it can never collide with (or be confused
// for) a device access token for a same-named FMDUser row. The two
// token kinds share the same in-memory AccessController map, but
// CheckAccessTokenAndGetUser (device path) and
// CheckAccessTokenAndGetAccount (account path, below) each only ever
// look up their own namespace.
const accountTokenNamespace = "account:"

var IsAccountUsernameValid = regexp.MustCompile("^[-_a-zA-Z0-9]{1,64}$").MatchString

var ErrAccountUsernameInvalid = errors.New("the requested account username must be alphanumeric and between 1 and 64 characters")
var ErrAccountUsernameNotAvailable = errors.New("the requested account username is not available")
var ErrAccountNotFound = errors.New("account not found")
var ErrAccountWrongPassword = errors.New("wrong password")
var ErrDeviceAlreadyLinked = errors.New("this device is already linked to an account")
var ErrDeviceNotFound = errors.New("device not found")

// CreateAccount registers a new account (a web-only login used to group
// and switch between devices). Follows the same client-side-Argon2 +
// server-side-sha512 password scheme as FMDUser, for consistency and to
// avoid introducing a second password-hashing implementation.
func (u *UserRepository) CreateAccount(requestedUsername string, innerSalt string, innerPwHash string) (*Account, error) {
	if !IsAccountUsernameValid(requestedUsername) {
		return nil, ErrAccountUsernameInvalid
	}

	existing, _ := u.UB.GetAccountByName(requestedUsername)
	if existing != nil {
		return nil, ErrAccountUsernameNotAvailable
	}

	account := Account{
		Username:  requestedUsername,
		CreatedAt: time.Now().Unix(),
	}
	account.setPasswordData(innerSalt, innerPwHash)

	u.UB.Create(&account)
	log.Info().Str("account", requestedUsername).Msg("registered new account")

	return &account, nil
}

// RequestAccountAccess authenticates an account login and returns a
// session token for it. Mirrors RequestAccess (device login), including
// reusing the same AccessController for lockout/rate-limiting -- just
// namespaced so account and device tokens/usernames can't collide.
func (u *UserRepository) RequestAccountAccess(username string, innerPwHash string, sessionDurationSeconds uint64, remoteIp string) (*Account, *AccessToken, error) {
	account, err := u.UB.GetAccountByName(username)
	if err != nil {
		return nil, nil, ErrAccountNotFound
	}

	tokenUsername := accountTokenNamespace + username

	if u.ACC.IsLocked(tokenUsername) {
		log.Warn().Str("account", username).Str("remoteIp", remoteIp).Msg("blocked account login attempt")
		return nil, nil, ErrAccountLocked
	}

	expected := account.HashedPassword
	actual := hashPasswordForLogin(innerPwHash)

	if actual != expected {
		u.ACC.IncrementLock(tokenUsername)
		log.Warn().Str("account", username).Str("remoteIp", remoteIp).Msg("failed account login attempt")
		return nil, nil, ErrAccountWrongPassword
	}

	u.ACC.ResetLock(tokenUsername)
	token := u.ACC.CreateNewAccessToken(tokenUsername, sessionDurationSeconds)
	return account, &token, nil
}

// CheckAccessTokenAndGetAccount resolves an account session token, the
// account-login equivalent of CheckAccessTokenAndGetUser.
func (u *UserRepository) CheckAccessTokenAndGetAccount(providedAccessToken string) (*Account, error) {
	tokenUsername, err := u.ACC.CheckAccessToken(providedAccessToken)
	if err != nil {
		return nil, err
	}
	if len(tokenUsername) <= len(accountTokenNamespace) || tokenUsername[:len(accountTokenNamespace)] != accountTokenNamespace {
		return nil, errors.New("not an account token")
	}
	username := tokenUsername[len(accountTokenNamespace):]

	account, err := u.UB.GetAccountByName(username)
	if err != nil {
		return nil, err
	}
	return account, nil
}

// LinkDeviceToAccount attaches an existing device to an account, so it
// shows up in that account's device switcher. Requires the device's OWN
// username + password (verified exactly like a normal device login) --
// an account can never pull in a device without proving it also knows
// that device's credentials. This does not touch the device's stored
// keys/locations/pictures at all.
func (u *UserRepository) LinkDeviceToAccount(account *Account, deviceUsername string, deviceInnerPwHash string) (*FMDUser, error) {
	device, err := u.UB.GetByName(deviceUsername)
	if err != nil {
		return nil, ErrDeviceNotFound
	}

	if device.AccountID != nil {
		return nil, ErrDeviceAlreadyLinked
	}

	expected := device.HashedPassword
	actual := hashPasswordForLogin(deviceInnerPwHash)
	if actual != expected {
		return nil, ErrWrongPassword
	}

	device.AccountID = &account.Id
	u.UB.Save(device)

	log.Info().Str("account", account.Username).Str("device", deviceUsername).Msg("linked device to account")
	return device, nil
}

// UnlinkDeviceFromAccount removes a device from an account's device
// list. The device itself, its password, and all its data are
// untouched -- it just stops appearing in this account's switcher and
// can be logged into standalone (or linked elsewhere) again.
func (u *UserRepository) UnlinkDeviceFromAccount(account *Account, deviceUsername string) error {
	device, err := u.UB.GetByName(deviceUsername)
	if err != nil {
		return ErrDeviceNotFound
	}

	if device.AccountID == nil || *device.AccountID != account.Id {
		return ErrDeviceNotFound
	}

	device.AccountID = nil
	u.UB.Save(device)

	log.Info().Str("account", account.Username).Str("device", deviceUsername).Msg("unlinked device from account")
	return nil
}

// GetDevicesForAccount lists the devices linked to an account. Only
// metadata (username/display name/tags/last seen) is returned -- never
// passwords, keys, locations, or pictures.
func (u *UserRepository) GetDevicesForAccount(account *Account) ([]FMDUser, error) {
	return u.UB.GetDevicesForAccount(account.Id)
}

// GetAccountSalt returns the stored Argon2 salt for an account, so the
// web client can derive the same login hash it registered with. Mirrors
// UserRepository.GetSalt (device path). Returns "" if not found -- same
// convention as GetSalt, so callers can't distinguish "no such account"
// from "no salt yet", which avoids leaking account existence.
func (u *UserRepository) GetAccountSalt(username string) string {
	account, err := u.UB.GetAccountByName(username)
	if err != nil {
		return ""
	}
	return account.Salt
}
