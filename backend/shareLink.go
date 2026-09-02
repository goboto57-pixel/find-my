package backend

import (
	"encoding/json"
	"net/http"

	"fmd-server/user"
)

// ------- Feature 3: time-limited public share links -------

const maxShareDurationSeconds = 7 * 24 * 60 * 60 // 7 days, sanity cap

type createShareLinkRequest struct {
	IDT              string // access token
	EncryptedPayload string // owner-encrypted blob; server cannot read it
	DurationSeconds  int64
}

type createShareLinkResponse struct {
	Token     string
	ExpiresAt int64
}

func postShareLink(w http.ResponseWriter, r *http.Request) {
	var data createShareLinkRequest
	if err := json.NewDecoder(r.Body).Decode(&data); err != nil {
		http.Error(w, ERR_JSON_INVALID, http.StatusBadRequest)
		return
	}
	u, err := uio.CheckAccessTokenAndGetUser(data.IDT)
	if err != nil {
		http.Error(w, ERR_ACCESS_TOKEN_INVALID, http.StatusUnauthorized)
		return
	}
	if data.EncryptedPayload == "" {
		http.Error(w, "EncryptedPayload must not be empty", http.StatusBadRequest)
		return
	}
	if data.DurationSeconds <= 0 || data.DurationSeconds > maxShareDurationSeconds {
		http.Error(w, "DurationSeconds out of range", http.StatusBadRequest)
		return
	}

	token, expiresAt, err := uio.CreateShareLink(u, data.EncryptedPayload, data.DurationSeconds)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	result, _ := json.Marshal(createShareLinkResponse{Token: token, ExpiresAt: expiresAt})
	w.Header().Set(HEADER_CONTENT_TYPE, CT_APPLICATION_JSON)
	w.Write(result)
}

type listShareLinksRequest struct {
	IDT string
}

type shareLinkSummary struct {
	Token     string
	ExpiresAt int64
	CreatedAt int64
}

type listShareLinksResponse struct {
	Links []shareLinkSummary
}

func getShareLinks(w http.ResponseWriter, r *http.Request) {
	var data listShareLinksRequest
	if err := json.NewDecoder(r.Body).Decode(&data); err != nil {
		http.Error(w, ERR_JSON_INVALID, http.StatusBadRequest)
		return
	}
	u, err := uio.CheckAccessTokenAndGetUser(data.IDT)
	if err != nil {
		http.Error(w, ERR_ACCESS_TOKEN_INVALID, http.StatusUnauthorized)
		return
	}

	links := uio.ListShareLinks(u)
	summaries := make([]shareLinkSummary, len(links))
	for i, l := range links {
		summaries[i] = shareLinkSummary{Token: l.Token, ExpiresAt: l.ExpiresAt, CreatedAt: l.CreatedAt}
	}

	result, _ := json.Marshal(listShareLinksResponse{Links: summaries})
	w.Header().Set(HEADER_CONTENT_TYPE, CT_APPLICATION_JSON)
	w.Write(result)
}

type revokeShareLinkRequest struct {
	IDT   string
	Token string
}

func postRevokeShareLink(w http.ResponseWriter, r *http.Request) {
	var data revokeShareLinkRequest
	if err := json.NewDecoder(r.Body).Decode(&data); err != nil {
		http.Error(w, ERR_JSON_INVALID, http.StatusBadRequest)
		return
	}
	u, err := uio.CheckAccessTokenAndGetUser(data.IDT)
	if err != nil {
		http.Error(w, ERR_ACCESS_TOKEN_INVALID, http.StatusUnauthorized)
		return
	}

	if err := uio.RevokeShareLink(u, data.Token); err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}
	w.WriteHeader(http.StatusOK)
}

// getPublicShareLink is intentionally unauthenticated: the random token in
// the URL is the only credential. It never sees or needs the decryption
// key, which stays client-side in the share URL's fragment.
type publicShareLinkResponse struct {
	EncryptedPayload string
	ExpiresAt        int64
}

func getPublicShareLink(w http.ResponseWriter, r *http.Request) {
	token := r.PathValue("token")
	if token == "" {
		http.Error(w, "missing token", http.StatusBadRequest)
		return
	}

	payload, expiresAt, err := uio.GetSharedLocation(token)
	if err != nil {
		if err == user.ErrShareLinkNotFound {
			http.Error(w, "not found or expired", http.StatusNotFound)
			return
		}
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	result, _ := json.Marshal(publicShareLinkResponse{EncryptedPayload: payload, ExpiresAt: expiresAt})
	w.Header().Set(HEADER_CONTENT_TYPE, CT_APPLICATION_JSON)
	w.Write(result)
}
