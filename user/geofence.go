package user

import (
	"errors"
	"time"
)

// Feature 1: geofencing.
//
// The server just stores fence definitions and serves them to the device
// (same access-token auth as getCommand); all the actual "am I inside this
// circle" math and enter/exit detection happens on the device, since that's
// where the live GPS fix is. The device reports transitions back via
// LogGeofenceEvent, which both writes an audit log entry and pings web push
// subscribers so the owner notices without needing to have the tab open.

const maxGeofencesPerUser = 50

var ErrGeofenceNotFound = errors.New("geofence not found")

func (u *UserRepository) CreateGeofence(
	fmdUser *FMDUser,
	name string,
	lat, lon, radiusMeters float64,
) (Geofence, error) {
	var count int64
	u.UB.DB.Model(&Geofence{}).Where("user_id = ?", fmdUser.Id).Count(&count)
	if count >= maxGeofencesPerUser {
		return Geofence{}, errors.New("too many geofences; delete one first")
	}

	entry := Geofence{
		UserID:       fmdUser.Id,
		Name:         name,
		Lat:          lat,
		Lon:          lon,
		RadiusMeters: radiusMeters,
		Enabled:      true,
		CreatedAt:    time.Now().Unix(),
	}
	result := u.UB.DB.Create(&entry)
	return entry, result.Error
}

func (u *UserRepository) ListGeofences(fmdUser *FMDUser) []Geofence {
	var entries []Geofence
	u.UB.DB.Where("user_id = ?", fmdUser.Id).Order("created_at DESC").Find(&entries)
	return entries
}

func (u *UserRepository) SetGeofenceEnabled(fmdUser *FMDUser, id uint64, enabled bool) error {
	result := u.UB.DB.Model(&Geofence{}).
		Where("id = ? AND user_id = ?", id, fmdUser.Id).
		Update("enabled", enabled)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return ErrGeofenceNotFound
	}
	return nil
}

func (u *UserRepository) DeleteGeofence(fmdUser *FMDUser, id uint64) error {
	result := u.UB.DB.Where("id = ? AND user_id = ?", id, fmdUser.Id).Delete(&Geofence{})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return ErrGeofenceNotFound
	}
	return nil
}

// LogGeofenceEvent is called by the device (not the owner) when it detects
// it has entered or left a fence. event should be "enter" or "exit".
func (u *UserRepository) LogGeofenceEvent(fmdUser *FMDUser, fenceName, event string) {
	u.LogAuditEvent(fmdUser, "geofence_"+event+":"+fenceName, "")
	u.NotifyWebPushSubscribers(fmdUser, "geofence")
}

// Feature 7: silent SOS. Logged distinctly from geofence/command events so
// it's unmistakable in the audit log, and pings web push subscribers with
// its own "sos" event so the web UI can show a more urgent notification
// than a routine location update.
func (u *UserRepository) LogSosTriggered(fmdUser *FMDUser) {
	u.LogAuditEvent(fmdUser, "sos_triggered", "")
	u.NotifyWebPushSubscribers(fmdUser, "sos")
}
