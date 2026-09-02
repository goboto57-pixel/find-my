package backend

import (
	"encoding/json"
	"net/http"
)

// ------- Feature 7: silent SOS -------

type sosTriggerRequest struct {
	IDT string // access token
}

// postSosTrigger is called by the device itself when the person carrying it
// silently triggers the SOS tile. It just logs the event and pings web push
// subscribers -- the actual ring/locate commands are queued directly on the
// device (see SilentSosService.kt), not routed through this endpoint.
func postSosTrigger(w http.ResponseWriter, r *http.Request) {
	var data sosTriggerRequest
	if err := json.NewDecoder(r.Body).Decode(&data); err != nil {
		http.Error(w, ERR_JSON_INVALID, http.StatusBadRequest)
		return
	}
	u, err := uio.CheckAccessTokenAndGetUser(data.IDT)
	if err != nil {
		http.Error(w, ERR_ACCESS_TOKEN_INVALID, http.StatusUnauthorized)
		return
	}

	uio.LogSosTriggered(u)
	w.WriteHeader(http.StatusOK)
}
