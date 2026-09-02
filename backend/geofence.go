package backend

import (
	"encoding/json"
	"net/http"
)

// ------- Feature 1: geofencing -------

type geofenceInfo struct {
	Id           uint64
	Name         string
	Lat          float64
	Lon          float64
	RadiusMeters float64
	Enabled      bool
}

type createGeofenceRequest struct {
	IDT          string
	Name         string
	Lat          float64
	Lon          float64
	RadiusMeters float64
}

func postGeofence(w http.ResponseWriter, r *http.Request) {
	var data createGeofenceRequest
	if err := json.NewDecoder(r.Body).Decode(&data); err != nil {
		http.Error(w, ERR_JSON_INVALID, http.StatusBadRequest)
		return
	}
	u, err := uio.CheckAccessTokenAndGetUser(data.IDT)
	if err != nil {
		http.Error(w, ERR_ACCESS_TOKEN_INVALID, http.StatusUnauthorized)
		return
	}
	if data.Name == "" || data.RadiusMeters <= 0 {
		http.Error(w, "Name and a positive RadiusMeters are required", http.StatusBadRequest)
		return
	}

	fence, err := uio.CreateGeofence(u, data.Name, data.Lat, data.Lon, data.RadiusMeters)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	result, _ := json.Marshal(geofenceInfo{
		Id: fence.Id, Name: fence.Name, Lat: fence.Lat, Lon: fence.Lon,
		RadiusMeters: fence.RadiusMeters, Enabled: fence.Enabled,
	})
	w.Header().Set(HEADER_CONTENT_TYPE, CT_APPLICATION_JSON)
	w.Write(result)
}

type listGeofencesRequest struct {
	IDT string
}

type listGeofencesResponse struct {
	Fences []geofenceInfo
}

// getGeofences is used both by the web UI (to display/manage fences) and
// by the device itself (to know what to check against) -- both authenticate
// the same way, via CheckAccessTokenAndGetUser.
func getGeofences(w http.ResponseWriter, r *http.Request) {
	var data listGeofencesRequest
	if err := json.NewDecoder(r.Body).Decode(&data); err != nil {
		http.Error(w, ERR_JSON_INVALID, http.StatusBadRequest)
		return
	}
	u, err := uio.CheckAccessTokenAndGetUser(data.IDT)
	if err != nil {
		http.Error(w, ERR_ACCESS_TOKEN_INVALID, http.StatusUnauthorized)
		return
	}

	fences := uio.ListGeofences(u)
	infos := make([]geofenceInfo, len(fences))
	for i, f := range fences {
		infos[i] = geofenceInfo{
			Id: f.Id, Name: f.Name, Lat: f.Lat, Lon: f.Lon,
			RadiusMeters: f.RadiusMeters, Enabled: f.Enabled,
		}
	}

	result, _ := json.Marshal(listGeofencesResponse{Fences: infos})
	w.Header().Set(HEADER_CONTENT_TYPE, CT_APPLICATION_JSON)
	w.Write(result)
}

type setGeofenceEnabledRequest struct {
	IDT     string
	Id      uint64
	Enabled bool
}

func postGeofenceEnabled(w http.ResponseWriter, r *http.Request) {
	var data setGeofenceEnabledRequest
	if err := json.NewDecoder(r.Body).Decode(&data); err != nil {
		http.Error(w, ERR_JSON_INVALID, http.StatusBadRequest)
		return
	}
	u, err := uio.CheckAccessTokenAndGetUser(data.IDT)
	if err != nil {
		http.Error(w, ERR_ACCESS_TOKEN_INVALID, http.StatusUnauthorized)
		return
	}
	if err := uio.SetGeofenceEnabled(u, data.Id, data.Enabled); err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}
	w.WriteHeader(http.StatusOK)
}

type deleteGeofenceRequest struct {
	IDT string
	Id  uint64
}

func postDeleteGeofence(w http.ResponseWriter, r *http.Request) {
	var data deleteGeofenceRequest
	if err := json.NewDecoder(r.Body).Decode(&data); err != nil {
		http.Error(w, ERR_JSON_INVALID, http.StatusBadRequest)
		return
	}
	u, err := uio.CheckAccessTokenAndGetUser(data.IDT)
	if err != nil {
		http.Error(w, ERR_ACCESS_TOKEN_INVALID, http.StatusUnauthorized)
		return
	}
	if err := uio.DeleteGeofence(u, data.Id); err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}
	w.WriteHeader(http.StatusOK)
}

// geofenceEventRequest is sent by the device (not the owner) when it
// detects an enter/exit transition for a fence.
type geofenceEventRequest struct {
	IDT       string
	FenceName string
	Event     string // "enter" or "exit"
}

func postGeofenceEvent(w http.ResponseWriter, r *http.Request) {
	var data geofenceEventRequest
	if err := json.NewDecoder(r.Body).Decode(&data); err != nil {
		http.Error(w, ERR_JSON_INVALID, http.StatusBadRequest)
		return
	}
	u, err := uio.CheckAccessTokenAndGetUser(data.IDT)
	if err != nil {
		http.Error(w, ERR_ACCESS_TOKEN_INVALID, http.StatusUnauthorized)
		return
	}
	if data.Event != "enter" && data.Event != "exit" {
		http.Error(w, "Event must be \"enter\" or \"exit\"", http.StatusBadRequest)
		return
	}

	uio.LogGeofenceEvent(u, data.FenceName, data.Event)
	w.WriteHeader(http.StatusOK)
}
