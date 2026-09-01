package backend

import (
	"encoding/json"
	"net/http"

	"fmd-server/user"
)

// ------- Feature 5: device tags / display name -------

type deviceMetaData struct {
	IDT         string // access token
	DisplayName string
	Tags        string
}

type deviceMetaResponse struct {
	DisplayName string
	Tags        string
}

func getDeviceMeta(w http.ResponseWriter, r *http.Request) {
	var data deviceMetaData
	if err := json.NewDecoder(r.Body).Decode(&data); err != nil {
		http.Error(w, ERR_JSON_INVALID, http.StatusBadRequest)
		return
	}
	u, err := uio.CheckAccessTokenAndGetUser(data.IDT)
	if err != nil {
		http.Error(w, ERR_ACCESS_TOKEN_INVALID, http.StatusUnauthorized)
		return
	}

	reply := deviceMetaResponse{DisplayName: uio.GetDisplayName(u), Tags: uio.GetTags(u)}
	result, _ := json.Marshal(reply)
	w.Header().Set(HEADER_CONTENT_TYPE, CT_APPLICATION_JSON)
	w.Write(result)
}

func postDeviceMeta(w http.ResponseWriter, r *http.Request) {
	var data deviceMetaData
	if err := json.NewDecoder(r.Body).Decode(&data); err != nil {
		http.Error(w, ERR_JSON_INVALID, http.StatusBadRequest)
		return
	}
	u, err := uio.CheckAccessTokenAndGetUser(data.IDT)
	if err != nil {
		http.Error(w, ERR_ACCESS_TOKEN_INVALID, http.StatusUnauthorized)
		return
	}

	uio.SetDisplayName(u, data.DisplayName)
	uio.SetTags(u, data.Tags)
	w.WriteHeader(http.StatusOK)
}

func mainDeviceMeta(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodPut:
		getDeviceMeta(w, r)
	case http.MethodPost:
		postDeviceMeta(w, r)
	}
}

// ------- Feature 6: audit log -------

type auditLogRequest struct {
	IDT string // access token
}

type auditLogEntry struct {
	Event     string
	RemoteIp  string
	CreatedAt int64
}

type auditLogResponse struct {
	Entries []auditLogEntry
}

func getAuditLog(w http.ResponseWriter, r *http.Request) {
	var data auditLogRequest
	if err := json.NewDecoder(r.Body).Decode(&data); err != nil {
		http.Error(w, ERR_JSON_INVALID, http.StatusBadRequest)
		return
	}
	u, err := uio.CheckAccessTokenAndGetUser(data.IDT)
	if err != nil {
		http.Error(w, ERR_ACCESS_TOKEN_INVALID, http.StatusUnauthorized)
		return
	}

	logs := uio.GetAuditLog(u)
	entries := make([]auditLogEntry, len(logs))
	for i, l := range logs {
		entries[i] = auditLogEntry{Event: l.Event, RemoteIp: l.RemoteIp, CreatedAt: l.CreatedAt}
	}

	result, _ := json.Marshal(auditLogResponse{Entries: entries})
	w.Header().Set(HEADER_CONTENT_TYPE, CT_APPLICATION_JSON)
	w.Write(result)
}

// ------- Feature 7: TOTP (2FA) -------

type totpRequest struct {
	IDT  string // access token
	Code string // required for confirm
}

type totpSetupResponse struct {
	Secret       string
	QrCodePngB64 string
}

type totpStatusResponse struct {
	Enabled bool
}

func postTotpSetup(w http.ResponseWriter, r *http.Request) {
	var data totpRequest
	if err := json.NewDecoder(r.Body).Decode(&data); err != nil {
		http.Error(w, ERR_JSON_INVALID, http.StatusBadRequest)
		return
	}
	u, err := uio.CheckAccessTokenAndGetUser(data.IDT)
	if err != nil {
		http.Error(w, ERR_ACCESS_TOKEN_INVALID, http.StatusUnauthorized)
		return
	}

	secret, qr, err := uio.BeginTotpSetup(u)
	if err != nil {
		http.Error(w, err.Error(), http.StatusConflict)
		return
	}

	result, _ := json.Marshal(totpSetupResponse{Secret: secret, QrCodePngB64: qr})
	w.Header().Set(HEADER_CONTENT_TYPE, CT_APPLICATION_JSON)
	w.Write(result)
}

func postTotpConfirm(w http.ResponseWriter, r *http.Request) {
	var data totpRequest
	if err := json.NewDecoder(r.Body).Decode(&data); err != nil {
		http.Error(w, ERR_JSON_INVALID, http.StatusBadRequest)
		return
	}
	u, err := uio.CheckAccessTokenAndGetUser(data.IDT)
	if err != nil {
		http.Error(w, ERR_ACCESS_TOKEN_INVALID, http.StatusUnauthorized)
		return
	}

	if err := uio.ConfirmTotpSetup(u, data.Code); err != nil {
		status := http.StatusBadRequest
		if err == user.ErrTotpInvalidCode {
			status = http.StatusUnauthorized
		}
		http.Error(w, err.Error(), status)
		return
	}

	w.WriteHeader(http.StatusOK)
}

func postTotpDisable(w http.ResponseWriter, r *http.Request) {
	var data totpRequest
	if err := json.NewDecoder(r.Body).Decode(&data); err != nil {
		http.Error(w, ERR_JSON_INVALID, http.StatusBadRequest)
		return
	}
	u, err := uio.CheckAccessTokenAndGetUser(data.IDT)
	if err != nil {
		http.Error(w, ERR_ACCESS_TOKEN_INVALID, http.StatusUnauthorized)
		return
	}

	if err := uio.DisableTotp(u); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.WriteHeader(http.StatusOK)
}

func postTotpStatus(w http.ResponseWriter, r *http.Request) {
	var data totpRequest
	if err := json.NewDecoder(r.Body).Decode(&data); err != nil {
		http.Error(w, ERR_JSON_INVALID, http.StatusBadRequest)
		return
	}
	u, err := uio.CheckAccessTokenAndGetUser(data.IDT)
	if err != nil {
		http.Error(w, ERR_ACCESS_TOKEN_INVALID, http.StatusUnauthorized)
		return
	}

	result, _ := json.Marshal(totpStatusResponse{Enabled: uio.GetTotpStatus(u)})
	w.Header().Set(HEADER_CONTENT_TYPE, CT_APPLICATION_JSON)
	w.Write(result)
}
