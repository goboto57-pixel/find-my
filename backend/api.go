package backend

import (
	conf "fmd-server/config"
	"fmd-server/constants"
	frontend "fmd-server/web"
	"fmt"
	"net/http"

	"github.com/spf13/viper"
)

const HEADER_CONTENT_TYPE = "Content-Type"
const CT_APPLICATION_JSON = "application/json"

const ERR_JSON_INVALID = "Invalid JSON"

var remoteIpHeaderName string = ""

func getRemoteIp(r *http.Request) string {
	remoteIp := r.Header.Get(remoteIpHeaderName)
	if remoteIp == "" {
		remoteIp = r.RemoteAddr
	}
	return remoteIp
}

// Adds various security headers.
// Check your deployment with https://securityheaders.com.
func securityHeadersMiddleware(next http.Handler, tileServerOrigin string) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-Xss-Protection", "1; mode=block")
		w.Header().Set("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: "+tileServerOrigin+"; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests")
		w.Header().Set("Permissions-Policy", "camera=(), microphone=()")

		// OpenStreetMap requires Referrer headers to be sent:
		// https://operations.osmfoundation.org/policies/tiles/
		w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")

		next.ServeHTTP(w, r)
	})
}

func getVersion(w http.ResponseWriter, r *http.Request) {
	fmt.Fprint(w, constants.VERSION)
}

func buildServeMux(config *viper.Viper) http.Handler {
	// Workaround: cache value in global field to avoid needing to pass down the config into the API code
	remoteIpHeaderName = config.GetString(conf.CONF_REMOTE_IP_HEADER)

	tileServerUrl, tileServerOrigin := conf.ValidateTileServerUrl(config.GetString(conf.CONF_TILE_SERVER_URL))
	tileServerUrlHandler := tileServerUrlHandler{tileServerUrl}

	mainDeviceHandler := mainDeviceHandler{createDeviceHandler{config.GetString(conf.CONF_REGISTRATION_TOKEN)}}

	apiV1Mux := http.NewServeMux()
	apiV1Mux.HandleFunc("/command", mainCommand)
	apiV1Mux.HandleFunc("/command/", mainCommand)
	apiV1Mux.HandleFunc("/location", mainLocation)
	apiV1Mux.HandleFunc("/location/", mainLocation)
	apiV1Mux.HandleFunc("/locations", getAllLocations)
	apiV1Mux.HandleFunc("/locations/", getAllLocations)
	apiV1Mux.HandleFunc("/locations/delete", deleteAllLocations)
	apiV1Mux.HandleFunc("/locations/delete/", deleteAllLocations)
	apiV1Mux.HandleFunc("/locationDataSize", getLocationDataSize)
	apiV1Mux.HandleFunc("/locationDataSize/", getLocationDataSize)
	apiV1Mux.HandleFunc("/picture", mainPicture)
	apiV1Mux.HandleFunc("/picture/", mainPicture)
	apiV1Mux.HandleFunc("/pictures", getAllPictures)
	apiV1Mux.HandleFunc("/pictures/", getAllPictures)
	apiV1Mux.HandleFunc("/pictures/delete", deleteAllPictures)
	apiV1Mux.HandleFunc("/pictures/delete/", deleteAllPictures)
	apiV1Mux.HandleFunc("/pictureSize", getPictureSize)
	apiV1Mux.HandleFunc("/pictureSize/", getPictureSize)
	apiV1Mux.HandleFunc("/key", getPrivKey)
	apiV1Mux.HandleFunc("/key/", getPrivKey)
	apiV1Mux.HandleFunc("/pubKey", getPubKey)
	apiV1Mux.HandleFunc("/pubKey/", getPubKey)
	apiV1Mux.Handle("/device", mainDeviceHandler)
	apiV1Mux.Handle("/device/", mainDeviceHandler)
	apiV1Mux.HandleFunc("/password", postPassword)
	apiV1Mux.HandleFunc("/password/", postPassword)
	apiV1Mux.HandleFunc("/push", mainPushUrl)
	apiV1Mux.HandleFunc("/push/", mainPushUrl)
	apiV1Mux.HandleFunc("/salt", requestSalt)
	apiV1Mux.HandleFunc("/salt/", requestSalt)
	apiV1Mux.HandleFunc("/requestAccess", requestAccess)
	apiV1Mux.HandleFunc("/requestAccess/", requestAccess)
	apiV1Mux.Handle("/tileServerUrl", tileServerUrlHandler)
	apiV1Mux.Handle("/tileServerUrl/", tileServerUrlHandler)
	apiV1Mux.HandleFunc("/version", getVersion)
	apiV1Mux.HandleFunc("/version/", getVersion)
	apiV1Mux.HandleFunc("/deviceMeta", mainDeviceMeta)
	apiV1Mux.HandleFunc("/deviceMeta/", mainDeviceMeta)
	apiV1Mux.HandleFunc("/auditLog", getAuditLog)
	apiV1Mux.HandleFunc("/auditLog/", getAuditLog)
	apiV1Mux.HandleFunc("/commandLog", getCommandLog)
	apiV1Mux.HandleFunc("/commandLog/", getCommandLog)
	apiV1Mux.HandleFunc("/commandLog/result", postCommandResult)
	apiV1Mux.HandleFunc("/commandLog/result/", postCommandResult)
	apiV1Mux.HandleFunc("/share", postShareLink)
	apiV1Mux.HandleFunc("/share/", postShareLink)
	apiV1Mux.HandleFunc("/share/list", getShareLinks)
	apiV1Mux.HandleFunc("/share/list/", getShareLinks)
	apiV1Mux.HandleFunc("/share/revoke", postRevokeShareLink)
	apiV1Mux.HandleFunc("/share/revoke/", postRevokeShareLink)
	apiV1Mux.HandleFunc("GET /share/public/{token}", getPublicShareLink)
	apiV1Mux.HandleFunc("/webpush/vapidPublicKey", getVapidPublicKey)
	apiV1Mux.HandleFunc("/webpush/vapidPublicKey/", getVapidPublicKey)
	apiV1Mux.HandleFunc("/webpush/subscribe", postWebPushSubscribe)
	apiV1Mux.HandleFunc("/webpush/subscribe/", postWebPushSubscribe)
	apiV1Mux.HandleFunc("/webpush/unsubscribe", postWebPushUnsubscribe)
	apiV1Mux.HandleFunc("/webpush/unsubscribe/", postWebPushUnsubscribe)
	apiV1Mux.HandleFunc("/geofence", postGeofence)
	apiV1Mux.HandleFunc("/geofence/", postGeofence)
	apiV1Mux.HandleFunc("/geofence/list", getGeofences)
	apiV1Mux.HandleFunc("/geofence/list/", getGeofences)
	apiV1Mux.HandleFunc("/geofence/enabled", postGeofenceEnabled)
	apiV1Mux.HandleFunc("/geofence/enabled/", postGeofenceEnabled)
	apiV1Mux.HandleFunc("/geofence/delete", postDeleteGeofence)
	apiV1Mux.HandleFunc("/geofence/delete/", postDeleteGeofence)
	apiV1Mux.HandleFunc("/geofence/event", postGeofenceEvent)
	apiV1Mux.HandleFunc("/geofence/event/", postGeofenceEvent)
	apiV1Mux.HandleFunc("/sos", postSosTrigger)
	apiV1Mux.HandleFunc("/sos/", postSosTrigger)
	apiV1Mux.HandleFunc("/totp/setup", postTotpSetup)
	apiV1Mux.HandleFunc("/totp/setup/", postTotpSetup)
	apiV1Mux.HandleFunc("/totp/confirm", postTotpConfirm)
	apiV1Mux.HandleFunc("/totp/confirm/", postTotpConfirm)
	apiV1Mux.HandleFunc("/totp/disable", postTotpDisable)
	apiV1Mux.HandleFunc("/totp/disable/", postTotpDisable)
	apiV1Mux.HandleFunc("/totp/status", postTotpStatus)
	apiV1Mux.HandleFunc("/totp/status/", postTotpStatus)

	// Multi-device: Account API (separate web-only login used to group
	// and switch between several devices; see backend/account_api.go).
	apiV1Mux.HandleFunc("/account/register", registerAccount)
	apiV1Mux.HandleFunc("/account/register/", registerAccount)
	apiV1Mux.HandleFunc("/account/salt", requestAccountSalt)
	apiV1Mux.HandleFunc("/account/salt/", requestAccountSalt)
	apiV1Mux.HandleFunc("/account/requestAccess", requestAccountAccess)
	apiV1Mux.HandleFunc("/account/requestAccess/", requestAccountAccess)
	apiV1Mux.HandleFunc("/account/devices", getAccountDevices)
	apiV1Mux.HandleFunc("/account/devices/", getAccountDevices)
	apiV1Mux.HandleFunc("/account/devices/link", linkAccountDevice)
	apiV1Mux.HandleFunc("/account/devices/link/", linkAccountDevice)
	apiV1Mux.HandleFunc("/account/devices/unlink", unlinkAccountDevice)
	apiV1Mux.HandleFunc("/account/devices/unlink/", unlinkAccountDevice)

	// Uncomment this once the API v1 is no longer hosted at the root "/" (because we cannot have two "/" in muxFinal).
	// Until then, as a side-effect, the static files are also served under /api/v1/.
	// staticFilesMux := http.NewServeMux()
	// staticFilesMux.Handle("/", http.FileServer(http.FS(frontend.WebDir())))
	// Handling --web-dir parameter/config
	if config.GetString(conf.CONF_WEB_DIR) == "" {
		apiV1Mux.Handle("/", frontend.FileServerWithFallback(frontend.WebDir()))
	} else {
		apiV1Mux.Handle("/", http.FileServer(http.Dir(config.GetString(conf.CONF_WEB_DIR))))
	}

	mux := http.NewServeMux()
	// mux.Handle("/", staticFilesMux)
	mux.Handle("/", apiV1Mux) // deprecated
	mux.Handle("/api/v1/", http.StripPrefix("/api/v1", apiV1Mux))

	// Also serve the version in the root path
	mux.HandleFunc("/version", getVersion)
	mux.HandleFunc("/version/", getVersion)

	// Apply to all endpoints
	handler := securityHeadersMiddleware(mux, tileServerOrigin)
	handler = http.MaxBytesHandler(handler, 15<<20) // 15 MB because 2^20 is a MB

	return handler
}
