package user

import (
	"errors"
	"net/url"
	"os"
	"path/filepath"

	"github.com/ncruces/go-sqlite3/gormlite"
	"github.com/rs/zerolog/log"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
	"gorm.io/gorm/logger"
)

type FMDDB struct {
	DB *gorm.DB
}

// For GORM (SQL)
// User Table
type FMDUser struct {
	Id             uint64 `gorm:"primaryKey"`
	Username       string `gorm:"uniqueIndex"`
	Salt           string // salt for the inner password hash performed by the client. This is stored for returning it to the client. It is not used by the server.
	HashedPassword string
	PushUrl        string
	LastSeenTime   int64

	// Deprecated crypto protocol
	PrivateKey    string
	PublicKey     string
	CommandToUser string
	CommandTime   uint64
	CommandSig    string
	Locations     []Location `gorm:"foreignKey:UserID;constraint:OnDelete:CASCADE;"`
	Pictures      []Picture  `gorm:"foreignKey:UserID;constraint:OnDelete:CASCADE;"`

	// Feature 5: device tags / display name (metadata only, never touches
	// the E2E-encrypted location/picture payloads).
	DisplayName string
	Tags        string // comma-separated tags, server treats this as an opaque string

	// Feature 7: TOTP (2FA) for login. Secret is stored server-side because
	// login itself is a server-side operation (unlike location data, which
	// is end-to-end encrypted and never touches the server in plaintext).
	TotpSecret  string
	TotpEnabled bool

	// Multi-device: optional link to the Account (if any) used to manage
	// this device from the web UI's device switcher. Nil for devices that
	// were never linked to an account -- those keep logging in standalone,
	// exactly as before this feature existed.
	AccountID *uint64 `gorm:"index"`
}

// Location Table of the Users
type Location struct {
	Id       uint64 `gorm:"primaryKey"`
	UserID   uint64 `gorm:"index"`
	Position string // elements must be string-encoded JSON structures
}

// Picture Table for the Users
type Picture struct {
	Id      uint64 `gorm:"primaryKey"`
	UserID  uint64 `gorm:"index"`
	Content string // elements are base64 encoded encrypted images
}

// Feature 6: Audit log. Stores metadata about account access/actions only
// (event name, remote IP, timestamp) -- never location content.
type AuditLog struct {
	Id        uint64 `gorm:"primaryKey"`
	UserID    uint64 `gorm:"index"`
	Event     string
	RemoteIp  string
	CreatedAt int64
}

// Feature 1: geofencing. Plaintext at rest -- same trust boundary as
// commands (owner authenticated over HTTPS), not part of the E2E-encrypted
// location/picture path.
type Geofence struct {
	Id           uint64 `gorm:"primaryKey"`
	UserID       uint64 `gorm:"index"`
	Name         string
	Lat          float64
	Lon          float64
	RadiusMeters float64
	Enabled      bool
	CreatedAt    int64
}

// Feature 10: web push subscriptions, used to notify the web UI of new
// locations/pictures instead of relying on it to poll. Standard Web Push
// subscription fields (endpoint + keys); payloads sent through it are just
// "something changed, go refetch" pings, never location content itself.
type WebPushSubscription struct {
	Id        uint64 `gorm:"primaryKey"`
	UserID    uint64 `gorm:"index"`
	Endpoint  string `gorm:"uniqueIndex"`
	P256dh    string
	Auth      string
	CreatedAt int64
}

// Feature 3: time-limited public share links. The server only ever stores
// an opaque, owner-encrypted blob (encrypted_payload) -- the AES key that
// decrypts it lives solely in the share URL's fragment (#...), which
// browsers never send to any server. This is a re-encryption of a single
// snapshot the owner chose to share, not a live feed of the device's
// regular E2E-encrypted location history.
type SharedLocation struct {
	Id               uint64 `gorm:"primaryKey"`
	UserID           uint64 `gorm:"index"`
	Token            string `gorm:"uniqueIndex"`
	EncryptedPayload string
	ExpiresAt        int64
	CreatedAt        int64
}

// Feature 9: command delivery status. One row per command sent to a
// device, tracking its lifecycle from "sent" through "delivered" (the
// device polled and received it) to a final "executed" or "failed"
// result reported back by the device. Never stores anything about the
// E2E-encrypted payloads themselves -- just the command name/status.
type CommandLog struct {
	Id          uint64 `gorm:"primaryKey"`
	UserID      uint64 `gorm:"index"`
	Command     string
	Status      string // "sent" | "delivered" | "executed" | "failed"
	SentAt      int64
	DeliveredAt int64 // 0 until delivered
	ResolvedAt  int64 // 0 until executed/failed
}

// Account represents a *login* an owner uses on the web UI to see and
// switch between several of their devices. It intentionally does NOT
// carry any encryption material: locations/pictures stay end-to-end
// encrypted per-device exactly as before, keyed by that device's own
// password. Linking a device to an account is a convenience/grouping
// step (see UserRepository.LinkDeviceToAccount) -- it never grants the
// account access to a device's data without that device's own password.
type Account struct {
	Id             uint64 `gorm:"primaryKey"`
	Username       string `gorm:"uniqueIndex"`
	Salt           string // see FMDUser.Salt: same client-side-Argon2 scheme, reused for consistency
	HashedPassword string
	CreatedAt      int64

	Devices []FMDUser `gorm:"foreignKey:AccountID;constraint:OnDelete:SET NULL;"`
}

// Settings Table GORM (SQL)
type DBSetting struct {
	Id      uint64 `gorm:"primaryKey"`
	Setting string `gorm:"uniqueIndex"`
	Value   string
}

// NewFMDDB opens the database backend.
//
// If databaseUrl is non-empty, it is treated as a Postgres DSN
// (e.g. "postgres://user:pass@host:5432/dbname?sslmode=require") and
// Postgres is used as the backend. This is the recommended mode for
// deployments such as Render, where local disk storage is ephemeral.
//
// If databaseUrl is empty, the legacy embedded SQLite file backend
// (dbDir/fmd.sqlite) is used instead, preserving behavior for existing
// self-hosted installs that don't set DatabaseUrl.
func NewFMDDB(dbDir string, databaseUrl string) *FMDDB {
	if databaseUrl != "" {
		return initPostgres(databaseUrl)
	}
	return NewFMDDBSQLite(dbDir)
}

func NewFMDDBSQLite(dbDir string) *FMDDB {
	dbFile := filepath.Join(dbDir, "fmd.sqlite")

	_, err := os.Stat(dbFile)
	if os.IsNotExist(err) {
		log.Info().Msg("no SQLite DB found, creating one")

		// Create directory
		err := os.MkdirAll(filepath.Join(dbDir), 0770)
		if err != nil {
			log.Fatal().Err(err).Msg("failed to create dbDir")
		}

		// Create file
		_, err = os.OpenFile(dbFile, os.O_RDWR|os.O_CREATE|os.O_EXCL, 0660)
		if err != nil {
			log.Fatal().Err(err).Msg("failed to create database file")
		}
	}

	info, err := os.Stat(dbFile)
	if err != nil {
		log.Fatal().Err(err).Msg("failed to access database file")
		os.Exit(1) // make nilaway happy
	}

	// Enforce that the DB file is not globally accessible
	_ = os.Chmod(filepath.Join(dbDir, "fmd.sqlite"), info.Mode()&^0007)
	_ = os.Chmod(filepath.Join(dbDir, "fmd.sqlite-shm"), info.Mode()&^0007)
	_ = os.Chmod(filepath.Join(dbDir, "fmd.sqlite-wal"), info.Mode()&^0007)

	return initSQLite(dbFile)
}

func newGormLogger() logger.Interface {
	return logger.New(
		&log.Logger,
		logger.Config{
			IgnoreRecordNotFoundError: false,
			LogLevel:                  logger.Warn,
		},
	)
}

func initPostgres(databaseUrl string) *FMDDB {
	log.Info().Msg("connecting to Postgres database")

	db, err := gorm.Open(postgres.Open(databaseUrl), &gorm.Config{
		Logger: newGormLogger(),
	})
	if err != nil {
		log.Fatal().Err(err).Msg("failed to open Postgres database")
		os.Exit(1) // make nilaway happy
		return nil
	}

	migrateDatabase(db)

	return &FMDDB{DB: db}
}

func initSQLite(path string) *FMDDB {
	newLogger := newGormLogger()

	// These PRAGMAs must be set for every connection opened by database/sql.
	// In particular, foreign_keys is connection-local, so executing it once
	// after gorm.Open does not reliably enable it for the whole connection pool.
	query := url.Values{}
	query.Add("_pragma", "busy_timeout(5000)")
	query.Add("_pragma", "foreign_keys(ON)")
	query.Add("_pragma", "secure_delete(ON)")
	query.Add("_pragma", "journal_mode(WAL)")
	dsn := (&url.URL{
		Scheme:   "file",
		OmitHost: true,
		Path:     filepath.ToSlash(path),
		RawQuery: query.Encode(),
	}).String()

	db, err := gorm.Open(gormlite.Open(dsn), &gorm.Config{
		Logger: newLogger,
	})
	if err != nil {
		log.Fatal().Err(err).Msg("failed to open database")
		os.Exit(1) // make nilaway happy
		return nil
	}

	migrateDatabase(db)

	return &FMDDB{DB: db}
}

func (db *FMDDB) GetLastID() int {
	var user FMDUser
	db.DB.Last(&user)
	if user.Id == 0 {
		return -1
	}
	return int(user.Id)
}

func (db *FMDDB) GetByName(username string) (*FMDUser, error) {
	var user = FMDUser{Username: username}
	db.DB.Where(&user).Find(&user)
	if user.Id == 0 {
		return nil, errors.New("user not found")
	}
	return &user, nil
}

func (db *FMDDB) GetAccountByName(username string) (*Account, error) {
	var account = Account{Username: username}
	db.DB.Where(&account).Find(&account)
	if account.Id == 0 {
		return nil, errors.New("account not found")
	}
	return &account, nil
}

func (db *FMDDB) GetDevicesForAccount(accountId uint64) ([]FMDUser, error) {
	var devices []FMDUser
	result := db.DB.
		Select("id", "username", "display_name", "tags", "last_seen_time").
		Where("account_id = ?", accountId).
		Order("username ASC").
		Find(&devices)
	if result.Error != nil {
		return nil, result.Error
	}
	return devices, nil
}

func (db *FMDDB) PreloadLocations(user *FMDUser) {
	db.DB.Preload("Locations").Where(&user).Find(&user)
}

func (db *FMDDB) PreloadPictures(user *FMDUser) {
	db.DB.Preload("Pictures").Where(&user).Find(&user)
}

func (db *FMDDB) Save(value interface{}) {
	db.DB.Save(value)
}

func (db *FMDDB) Create(value interface{}) {
	db.DB.Create(value)
}

func (db *FMDDB) Delete(value interface{}) int64 {
	// Theoretically, this should work via foreign key + cascade.
	// It works when manually executing SQL commands via DB Browser, but not via gorm??
	// Thus, we manually select the associations here to do the cascading deletion.
	// https://gorm.io/docs/associations.html#Delete-Associations
	var result = db.DB.Select(clause.Associations).Delete(value)
	return result.RowsAffected
}

func (db *FMDDB) GetUsersCount() (int64, error) {
	var count int64
	result := db.DB.Model(&FMDUser{}).Count(&count)

	if result.Error != nil {
		return -1, result.Error
	}
	return count, nil
}

func (db *FMDDB) GetUsersLastSeenBefore(unixSeconds int64) ([]FMDUser, error) {
	var users []FMDUser

	result := db.DB.
		// Select only the fields that are necessary for where this function is used.
		Select("username", "last_seen_time", "push_url").
		Where("last_seen_time < ?", unixSeconds).
		// Order: First all empty push URLs. Then from old to new last seen times.
		Order("(push_url IS NULL OR push_url = '') DESC, last_seen_time ASC, username ASC").
		Find(&users)

	if result.Error != nil {
		return nil, result.Error
	}
	return users, nil
}
