package user

import (
	"errors"
	"fmd-server/migrations"
	"fmt"
	"strconv"
	"strings"

	"github.com/rs/zerolog/log"
	"gorm.io/gorm"
)

const CurrentSqlVersion = 7

const KeyVersion = "fmd_db_version"

// dialectName returns "postgres" or "sqlite", matching the suffix used
// on dialect-specific migration files (e.g. 000001_create_tables_postgres.up.sql).
// gorm's Dialector.Name() returns "postgres" for the postgres driver and
// "sqlite3" for the go-sqlite3/gormlite driver.
func dialectName(db *gorm.DB) string {
	if db.Dialector.Name() == "postgres" {
		return "postgres"
	}
	return "sqlite"
}

func migrateDatabase(db *gorm.DB) {
	log.Info().Msg("migrating database...")

	dialect := dialectName(db)

	// This initial migration MUST be idempotent.
	// It should use IF NOT EXISTS in order to work correctly
	// with existing installtions (and not break them).
	//
	// This has a dialect-specific variant (000001_create_tables_postgres) because
	// SQLite and Postgres do not share identifier/auto-increment syntax.
	// The historic, un-suffixed SQLite file is kept as-is for existing installs.
	err := runInitialTablesMigration(dialect, db)
	if err != nil {
		log.Fatal().Err(err).Msg("failed to create initial database layout")
		return
	}

	var dbSetting DBSetting
	res := db.First(&dbSetting, "setting = ?", KeyVersion)

	if errors.Is(res.Error, gorm.ErrRecordNotFound) {
		log.Info().Msg("schema version does not yet exist, creating it")
		dbSetting = DBSetting{Setting: KeyVersion, Value: "0"}
		db.Create(&dbSetting)
	}

	actualVersion, err := strconv.Atoi(dbSetting.Value)
	if err != nil {
		log.Warn().Err(err).Msg("failed to get current schema version")
		// Log warning, and continue to try and migrate the database
	}

	log.Info().
		Int("actualVersion", actualVersion).
		Int("CurrentSqlVersion", CurrentSqlVersion).
		Msg("db versions")

	if actualVersion >= CurrentSqlVersion {
		log.Info().Msg("nothing to migrate")
		return
	}

	if actualVersion < 2 {
		err := runMigration("000002_add_last_seen_time", db)
		if err != nil {
			log.Fatal().Err(err).Msg("failed migration=000002_add_last_seen_time")
			return
		}
	}

	if actualVersion < 3 {
		migrateToV2Passwords(db)
	}

	if actualVersion < 4 {
		err := runMigration("000004_rename_user_id_name", db)
		if err != nil {
			log.Fatal().Err(err).Msg("failed migration=000004_rename_user_id_name")
			return
		}
	}

	if actualVersion < 5 {
		// Dialect-neutral: plain ALTER TABLE ADD COLUMN, same file for both DBs.
		err := runMigration("000005_add_features", db)
		if err != nil {
			log.Fatal().Err(err).Msg("failed migration=000005_add_features")
			return
		}
	}

	if actualVersion < 6 {
		err := runDialectMigration("000006_create_audit_logs", dialect, db)
		if err != nil {
			log.Fatal().Err(err).Msg("failed migration=000006_create_audit_logs")
			return
		}
	}

	if actualVersion < 7 {
		// Postgres-only bugfix: totp_enabled was created as `integer` by
		// migration 5, but the Go struct uses `bool`, which pgx cannot
		// encode into int4. See the postgres .up.sql for full context.
		err := runDialectMigration("000007_fix_totp_enabled_type", dialect, db)
		if err != nil {
			log.Fatal().Err(err).Msg("failed migration=000007_fix_totp_enabled_type")
			return
		}
	}

	// Use this to let GORM write a migration. Then inspect the created SQLite schema,
	// and write an "up" migration from hand.
	// db.AutoMigrate(&DBSetting{})

	// Set this at the end. This way, if the migrations are interrupted
	// (e.g., the program cancelled), they are re-run upon the next start.
	db.Model(&dbSetting).Update("Value", fmt.Sprint(CurrentSqlVersion))
	log.Info().Msg("database successfully migrated")
}

func runMigration(name string, db *gorm.DB) error {
	log.Info().Str("name", name).Msg("running sql")
	sql, err := migrations.MigrationFS.ReadFile(fmt.Sprintf("%s.up.sql", name))
	if err != nil {
		return err
	}
	err = db.Exec(string(sql)).Error
	return err
}

// runInitialTablesMigration keeps backward compatibility with existing SQLite
// installs (which ran the un-suffixed "000001_create_tables" file), while
// routing Postgres to its dedicated dialect-specific file.
func runInitialTablesMigration(dialect string, db *gorm.DB) error {
	if dialect == "postgres" {
		return runMigration("000001_create_tables_postgres", db)
	}
	return runMigration("000001_create_tables", db)
}

// runDialectMigration runs "<name>_sqlite.up.sql" or "<name>_postgres.up.sql"
// depending on dialect, for migrations whose SQL is not portable between the two.
func runDialectMigration(name string, dialect string, db *gorm.DB) error {
	return runMigration(fmt.Sprintf("%s_%s", name, dialect), db)
}

// DB Version 3 / Password version 2

func migrateToV2Passwords(db *gorm.DB) {
	var users []FMDUser
	db.Find(&users)

	for idx, u := range users {
		// Log progress every few users (because hashing can take some time).
		if idx%100 == 0 {
			log.Info().
				Int("current", idx+1).
				Int("total", len(users)).
				Msg("migrating user")
		}

		if strings.HasPrefix(u.HashedPassword, PwPrefixV2) {
			// Idempotence: skip already migrated passwords
			continue
		}

		u.setPasswordData(u.Salt, u.HashedPassword)
		db.Save(u)
	}
}
