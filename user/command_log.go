package user

import (
	"errors"
	"time"
)

var ErrInvalidCommandStatus = errors.New("invalid command status: must be \"executed\" or \"failed\"")
var ErrNoDeliveredCommand = errors.New("no delivered command awaiting a result for this user")

// Feature 9: command delivery status.
//
// Lifecycle: postCommand -> LogCommandSent ("sent") -> device polls via
// getCommand -> MarkLatestCommandDelivered ("delivered") -> device runs the
// command and reports back -> ResolveLatestCommand ("executed"/"failed").
//
// This is intentionally best-effort metadata for the owner's own visibility
// (e.g. "did the lock command actually reach the phone?"), not a guaranteed
// delivery/ack protocol. Only one row transitions at a time per user because
// today the server only ever holds a single pending command per device (see
// UserRepository.SetCommandToUser).

const maxCommandLogEntries = 200

const (
	CommandStatusSent      = "sent"
	CommandStatusDelivered = "delivered"
	CommandStatusExecuted  = "executed"
	CommandStatusFailed    = "failed"
)

func (u *UserRepository) LogCommandSent(user *FMDUser, command string) {
	entry := CommandLog{
		UserID: user.Id,
		Command: command,
		Status:  CommandStatusSent,
		SentAt:  time.Now().Unix(),
	}
	u.UB.Create(&entry)
	u.pruneCommandLog(user)
}

// MarkLatestCommandDelivered marks the most recent "sent" command (if any)
// as delivered. Called when the device polls and actually receives a
// non-empty pending command.
func (u *UserRepository) MarkLatestCommandDelivered(user *FMDUser) {
	var entry CommandLog
	result := u.UB.DB.
		Where("user_id = ? AND status = ?", user.Id, CommandStatusSent).
		Order("sent_at DESC, id DESC").
		First(&entry)
	if result.Error != nil {
		return
	}
	entry.Status = CommandStatusDelivered
	entry.DeliveredAt = time.Now().Unix()
	u.UB.DB.Save(&entry)
}

// ResolveLatestCommand records the final outcome ("executed" or "failed")
// reported back by the device for the most recently delivered command.
func (u *UserRepository) ResolveLatestCommand(user *FMDUser, status string) error {
	if status != CommandStatusExecuted && status != CommandStatusFailed {
		return ErrInvalidCommandStatus
	}

	var entry CommandLog
	result := u.UB.DB.
		Where("user_id = ? AND status = ?", user.Id, CommandStatusDelivered).
		Order("delivered_at DESC, id DESC").
		First(&entry)
	if result.Error != nil {
		return ErrNoDeliveredCommand
	}

	entry.Status = status
	entry.ResolvedAt = time.Now().Unix()
	u.UB.DB.Save(&entry)
	return nil
}

func (u *UserRepository) GetCommandLog(user *FMDUser) []CommandLog {
	var entries []CommandLog
	u.UB.DB.Where("user_id = ?", user.Id).Order("sent_at DESC, id DESC").Find(&entries)
	return entries
}

func (u *UserRepository) pruneCommandLog(user *FMDUser) {
	var count int64
	u.UB.DB.Model(&CommandLog{}).Where("user_id = ?", user.Id).Count(&count)

	if count <= maxCommandLogEntries {
		return
	}

	var oldest []CommandLog
	toDelete := int(count) - maxCommandLogEntries
	result := u.UB.DB.
		Where("user_id = ?", user.Id).
		Order("sent_at ASC, id ASC").
		Limit(toDelete).
		Find(&oldest)

	if result.Error != nil || len(oldest) == 0 {
		return
	}

	var ids []uint64
	for _, entry := range oldest {
		ids = append(ids, entry.Id)
	}
	u.UB.DB.Where("id IN ?", ids).Delete(&CommandLog{})
}
