package backend

import (
	"encoding/json"
	"net/http"
)

// ------- Feature 10: web push -------

type vapidPublicKeyResponse struct {
	PublicKey string
}

// getVapidPublicKey is intentionally unauthenticated -- VAPID public keys
// are, by design, public (they're embedded in every push subscription
// request the browser makes to the push service).
func getVapidPublicKey(w http.ResponseWriter, r *http.Request) {
	publicKey, _, err := uio.GetOrCreateVapidKeys()
	if err != nil {
		http.Error(w, "failed to load VAPID key", http.StatusInternalServerError)
		return
	}
	result, _ := json.Marshal(vapidPublicKeyResponse{PublicKey: publicKey})
	w.Header().Set(HEADER_CONTENT_TYPE, CT_APPLICATION_JSON)
	w.Write(result)
}

type webPushSubscribeRequest struct {
	IDT      string // access token
	Endpoint string
	P256dh   string
	Auth     string
}

func postWebPushSubscribe(w http.ResponseWriter, r *http.Request) {
	var data webPushSubscribeRequest
	if err := json.NewDecoder(r.Body).Decode(&data); err != nil {
		http.Error(w, ERR_JSON_INVALID, http.StatusBadRequest)
		return
	}
	u, err := uio.CheckAccessTokenAndGetUser(data.IDT)
	if err != nil {
		http.Error(w, ERR_ACCESS_TOKEN_INVALID, http.StatusUnauthorized)
		return
	}
	if data.Endpoint == "" || data.P256dh == "" || data.Auth == "" {
		http.Error(w, "Endpoint, P256dh and Auth are all required", http.StatusBadRequest)
		return
	}

	if err := uio.SaveWebPushSubscription(u, data.Endpoint, data.P256dh, data.Auth); err != nil {
		http.Error(w, "failed to save subscription", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusOK)
}

type webPushUnsubscribeRequest struct {
	IDT      string
	Endpoint string
}

func postWebPushUnsubscribe(w http.ResponseWriter, r *http.Request) {
	var data webPushUnsubscribeRequest
	if err := json.NewDecoder(r.Body).Decode(&data); err != nil {
		http.Error(w, ERR_JSON_INVALID, http.StatusBadRequest)
		return
	}
	u, err := uio.CheckAccessTokenAndGetUser(data.IDT)
	if err != nil {
		http.Error(w, ERR_ACCESS_TOKEN_INVALID, http.StatusUnauthorized)
		return
	}

	_ = uio.DeleteWebPushSubscription(u, data.Endpoint)
	w.WriteHeader(http.StatusOK)
}
