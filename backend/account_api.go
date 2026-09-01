package backend

import (
	"encoding/json"
	"fmt"
	"net/http"

	"fmd-server/user"
)

// ------- Multi-device: Account API -------
//
// An Account is a separate, web-only login used to group and switch
// between several devices. It never grants access to a device's
// end-to-end-encrypted data by itself -- see user.LinkDeviceToAccount.
//
// NOTE: this file is new and has not been exercised against a running
// server/database in this environment (no Go toolchain / DB available
// here) -- review and test before deploying.

type accountRegistrationData struct {
	Salt              string
	HashedPassword    string
	RequestedUsername string
}

// Reuses loginData's shape (IDT + PasswordHash + SessionDurationSeconds)
// conceptually, but Accounts have no TOTP support (yet), so we keep a
// dedicated, slightly smaller struct instead of reusing loginData as-is.
type accountLoginData struct {
	IDT                    string
	PasswordHash           string `json:"Data"`
	SessionDurationSeconds uint64
}

type accountDeviceLinkData struct {
	IDT                string // account access token
	DeviceUsername     string
	DevicePasswordHash string
}

type accountDeviceUnlinkData struct {
	IDT            string // account access token
	DeviceUsername string
}

type accountDeviceSummary struct {
	Username     string
	DisplayName  string
	Tags         string
	LastSeenTime int64
}

func registerAccount(w http.ResponseWriter, r *http.Request) {
	var reg accountRegistrationData
	err := json.NewDecoder(r.Body).Decode(&reg)
	if err != nil {
		http.Error(w, ERR_JSON_INVALID, http.StatusBadRequest)
		return
	}

	account, err := uio.CreateAccount(reg.RequestedUsername, reg.Salt, reg.HashedPassword)
	if err != nil {
		http.Error(w, fmt.Sprintf("failed to create account: %s", err.Error()), http.StatusBadRequest)
		return
	}

	responseData := createDeviceResponse{DeviceId: account.Username}
	result, _ := json.Marshal(responseData)
	w.Header().Set(HEADER_CONTENT_TYPE, CT_APPLICATION_JSON)
	w.Write(result)
}

func requestAccountSalt(w http.ResponseWriter, r *http.Request) {
	var data DataPackage
	err := json.NewDecoder(r.Body).Decode(&data)
	if err != nil {
		http.Error(w, ERR_JSON_INVALID, http.StatusBadRequest)
		return
	}
	if !user.IsAccountUsernameValid(data.IDT) {
		http.Error(w, "Invalid username", http.StatusBadRequest)
		return
	}

	salt := uio.GetAccountSalt(data.IDT)
	dataReply := DataPackage{IDT: data.IDT, Data: salt}
	result, _ := json.Marshal(dataReply)
	w.Header().Set(HEADER_CONTENT_TYPE, CT_APPLICATION_JSON)
	w.Write(result)
}

func requestAccountAccess(w http.ResponseWriter, r *http.Request) {
	var data accountLoginData
	err := json.NewDecoder(r.Body).Decode(&data)
	if err != nil {
		http.Error(w, ERR_JSON_INVALID, http.StatusBadRequest)
		return
	}
	if !user.IsAccountUsernameValid(data.IDT) {
		http.Error(w, "Invalid username", http.StatusBadRequest)
		return
	}

	_, accessToken, err := uio.RequestAccountAccess(data.IDT, data.PasswordHash, data.SessionDurationSeconds, getRemoteIp(r))

	if err == user.ErrAccountNotFound {
		http.Error(w, "Account not found", http.StatusNotFound)
		return
	}
	if err == user.ErrAccountLocked {
		http.Error(w, "Account is locked", http.StatusLocked)
		return
	}
	if err != nil {
		http.Error(w, "Access denied", http.StatusForbidden)
		return
	}

	accessTokenReply := DataPackage{IDT: data.IDT, Data: accessToken.Token}
	result, _ := json.Marshal(accessTokenReply)
	w.Header().Set(HEADER_CONTENT_TYPE, CT_APPLICATION_JSON)
	w.Write(result)
}

// getAccountDevices lists the devices linked to the account identified by
// the access token passed as the "idt" query parameter (GET, so it takes
// a query param rather than a JSON body).
func getAccountDevices(w http.ResponseWriter, r *http.Request) {
	accessToken := r.URL.Query().Get("idt")
	account, err := uio.CheckAccessTokenAndGetAccount(accessToken)
	if err != nil {
		http.Error(w, ERR_ACCESS_TOKEN_INVALID, http.StatusUnauthorized)
		return
	}

	devices, err := uio.GetDevicesForAccount(account)
	if err != nil {
		http.Error(w, "Failed to list devices", http.StatusInternalServerError)
		return
	}

	summaries := make([]accountDeviceSummary, 0, len(devices))
	for _, d := range devices {
		summaries = append(summaries, accountDeviceSummary{
			Username:     d.Username,
			DisplayName:  d.DisplayName,
			Tags:         d.Tags,
			LastSeenTime: d.LastSeenTime,
		})
	}

	result, _ := json.Marshal(summaries)
	w.Header().Set(HEADER_CONTENT_TYPE, CT_APPLICATION_JSON)
	w.Write(result)
}

// linkAccountDevice attaches an existing device to the account, proving
// knowledge of the device's own password in the same request (see
// user.LinkDeviceToAccount for why).
func linkAccountDevice(w http.ResponseWriter, r *http.Request) {
	var data accountDeviceLinkData
	err := json.NewDecoder(r.Body).Decode(&data)
	if err != nil {
		http.Error(w, ERR_JSON_INVALID, http.StatusBadRequest)
		return
	}

	account, err := uio.CheckAccessTokenAndGetAccount(data.IDT)
	if err != nil {
		http.Error(w, ERR_ACCESS_TOKEN_INVALID, http.StatusUnauthorized)
		return
	}

	_, err = uio.LinkDeviceToAccount(account, data.DeviceUsername, data.DevicePasswordHash)
	if err == user.ErrDeviceNotFound {
		http.Error(w, "Device not found", http.StatusNotFound)
		return
	}
	if err == user.ErrDeviceAlreadyLinked {
		http.Error(w, "Device is already linked to an account", http.StatusConflict)
		return
	}
	if err == user.ErrWrongPassword {
		http.Error(w, "Wrong device password", http.StatusForbidden)
		return
	}
	if err != nil {
		http.Error(w, "Failed to link device", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
}

func unlinkAccountDevice(w http.ResponseWriter, r *http.Request) {
	var data accountDeviceUnlinkData
	err := json.NewDecoder(r.Body).Decode(&data)
	if err != nil {
		http.Error(w, ERR_JSON_INVALID, http.StatusBadRequest)
		return
	}

	account, err := uio.CheckAccessTokenAndGetAccount(data.IDT)
	if err != nil {
		http.Error(w, ERR_ACCESS_TOKEN_INVALID, http.StatusUnauthorized)
		return
	}

	err = uio.UnlinkDeviceFromAccount(account, data.DeviceUsername)
	if err == user.ErrDeviceNotFound {
		http.Error(w, "Device not found", http.StatusNotFound)
		return
	}
	if err != nil {
		http.Error(w, "Failed to unlink device", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
}
