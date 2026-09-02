package backend

import (
	"encoding/json"
	"net/http"

	"fmd-server/user"
)

// ------- Feature 9: command delivery status -------

type commandLogRequest struct {
	IDT string // access token
}

type commandLogEntry struct {
	Command     string
	Status      string
	SentAt      int64
	DeliveredAt int64
	ResolvedAt  int64
}

type commandLogResponse struct {
	Entries []commandLogEntry
}

func getCommandLog(w http.ResponseWriter, r *http.Request) {
	var data commandLogRequest
	if err := json.NewDecoder(r.Body).Decode(&data); err != nil {
		http.Error(w, ERR_JSON_INVALID, http.StatusBadRequest)
		return
	}
	u, err := uio.CheckAccessTokenAndGetUser(data.IDT)
	if err != nil {
		http.Error(w, ERR_ACCESS_TOKEN_INVALID, http.StatusUnauthorized)
		return
	}

	logs := uio.GetCommandLog(u)
	entries := make([]commandLogEntry, len(logs))
	for i, l := range logs {
		entries[i] = commandLogEntry{
			Command:     l.Command,
			Status:      l.Status,
			SentAt:      l.SentAt,
			DeliveredAt: l.DeliveredAt,
			ResolvedAt:  l.ResolvedAt,
		}
	}

	result, _ := json.Marshal(commandLogResponse{Entries: entries})
	w.Header().Set(HEADER_CONTENT_TYPE, CT_APPLICATION_JSON)
	w.Write(result)
}

// commandResultRequest is sent by the Android app itself (not the web UI)
// after it finishes running a command it just fetched via getCommand, so the
// server/owner can see whether it actually succeeded.
type commandResultRequest struct {
	IDT    string // access token
	Status string // "executed" or "failed"
}

func postCommandResult(w http.ResponseWriter, r *http.Request) {
	var data commandResultRequest
	if err := json.NewDecoder(r.Body).Decode(&data); err != nil {
		http.Error(w, ERR_JSON_INVALID, http.StatusBadRequest)
		return
	}
	u, err := uio.CheckAccessTokenAndGetUser(data.IDT)
	if err != nil {
		http.Error(w, ERR_ACCESS_TOKEN_INVALID, http.StatusUnauthorized)
		return
	}

	if err := uio.ResolveLatestCommand(u, data.Status); err != nil {
		if err == user.ErrInvalidCommandStatus {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		// ErrNoDeliveredCommand: nothing to resolve, but that's not the
		// caller's fault (e.g. duplicate report) -- just no-op with 200.
	}
	w.WriteHeader(http.StatusOK)
}
