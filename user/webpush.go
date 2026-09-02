package user

import (
	"time"

	webpush "github.com/SherClockHolmes/webpush-go"
	"github.com/rs/zerolog/log"
)

// Feature 10: web push. The web UI subscribes once (browser Push API) and
// the server pings it with a content-free "something changed, refetch"
// message whenever a new location/picture/command arrives for that device,
// instead of the UI needing to poll on a timer. Never sends the actual
// location content through push -- the browser still fetches and decrypts
// the real data itself over the normal authenticated API.

const vapidPublicKeySetting = "vapid_public_key"
const vapidPrivateKeySetting = "vapid_private_key"

// GetOrCreateVapidKeys returns the server's VAPID keypair, generating and
// persisting one on first use. All devices/subscriptions share the same
// server-wide keypair, matching how Web Push is normally deployed.
func (u *UserRepository) GetOrCreateVapidKeys() (publicKey string, privateKey string, err error) {
	var pubSetting DBSetting
	pubRes := u.UB.DB.First(&pubSetting, "setting = ?", vapidPublicKeySetting)

	var privSetting DBSetting
	privRes := u.UB.DB.First(&privSetting, "setting = ?", vapidPrivateKeySetting)

	if pubRes.Error == nil && privRes.Error == nil {
		return pubSetting.Value, privSetting.Value, nil
	}

	newPrivate, newPublic, err := webpush.GenerateVAPIDKeys()
	if err != nil {
		return "", "", err
	}

	u.UB.DB.Create(&DBSetting{Setting: vapidPublicKeySetting, Value: newPublic})
	u.UB.DB.Create(&DBSetting{Setting: vapidPrivateKeySetting, Value: newPrivate})

	return newPublic, newPrivate, nil
}

func (u *UserRepository) SaveWebPushSubscription(user *FMDUser, endpoint, p256dh, auth string) error {
	entry := WebPushSubscription{
		UserID:    user.Id,
		Endpoint:  endpoint,
		P256dh:    p256dh,
		Auth:      auth,
		CreatedAt: time.Now().Unix(),
	}
	// Upsert on endpoint: browsers may re-register the same subscription.
	result := u.UB.DB.Where("endpoint = ?", endpoint).
		Assign(WebPushSubscription{UserID: user.Id, P256dh: p256dh, Auth: auth}).
		FirstOrCreate(&entry)
	return result.Error
}

func (u *UserRepository) DeleteWebPushSubscription(user *FMDUser, endpoint string) error {
	result := u.UB.DB.Where("user_id = ? AND endpoint = ?", user.Id, endpoint).
		Delete(&WebPushSubscription{})
	return result.Error
}

func (u *UserRepository) GetWebPushSubscriptions(user *FMDUser) []WebPushSubscription {
	var subs []WebPushSubscription
	u.UB.DB.Where("user_id = ?", user.Id).Find(&subs)
	return subs
}

// NotifyWebPushSubscribers pings every subscription for this device with a
// small opaque payload (just an event name like "location") telling the
// web UI to refetch. Best-effort: failures are logged, not returned,
// because a push failure should never block the caller (e.g. postLocation)
// from succeeding.
func (u *UserRepository) NotifyWebPushSubscribers(user *FMDUser, event string) {
	subs := u.GetWebPushSubscriptions(user)
	if len(subs) == 0 {
		return
	}

	publicKey, privateKey, err := u.GetOrCreateVapidKeys()
	if err != nil {
		log.Error().Err(err).Msg("failed to load VAPID keys, skipping web push")
		return
	}

	for _, sub := range subs {
		s := &webpush.Subscription{
			Endpoint: sub.Endpoint,
			Keys: webpush.Keys{
				P256dh: sub.P256dh,
				Auth:   sub.Auth,
			},
		}

		resp, err := webpush.SendNotification([]byte(event), s, &webpush.Options{
			VAPIDPublicKey:  publicKey,
			VAPIDPrivateKey: privateKey,
			TTL:             60,
		})
		if err != nil {
			log.Warn().Err(err).Str("endpoint", sub.Endpoint).Msg("web push send failed")
			continue
		}
		defer resp.Body.Close()

		// 404/410 mean the browser unsubscribed or the endpoint expired --
		// clean it up so we stop trying.
		if resp.StatusCode == 404 || resp.StatusCode == 410 {
			u.UB.DB.Where("id = ?", sub.Id).Delete(&WebPushSubscription{})
		}
	}
}
