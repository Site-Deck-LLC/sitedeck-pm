-- Sprint 12 Task 8: Notification preferences
-- One row per user. Global email/push/digest toggles + quiet hours +
-- per-kind override JSON. The in-app channel is always on (the bell
-- is a core product surface — there's no preference to disable it).

CREATE TABLE IF NOT EXISTS "notification_preferences" (
    "user_id" TEXT NOT NULL,
    "email_enabled" BOOLEAN NOT NULL DEFAULT true,
    "push_enabled" BOOLEAN NOT NULL DEFAULT false,
    "digest_enabled" BOOLEAN NOT NULL DEFAULT false,
    "quiet_start" TEXT NOT NULL DEFAULT '',
    "quiet_end" TEXT NOT NULL DEFAULT '',
    "kind_overrides" JSONB,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("user_id")
);
