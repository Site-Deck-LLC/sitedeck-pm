-- Sprint 8 Task 6 — Notification inbox.
-- One row per notification delivered to a user. The bell icon
-- surfaces unread counts; clicking a row marks it read.
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "payload" JSONB,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- Most common access pattern: "show me my unread notifications,
-- newest first." Composite index covers the WHERE + ORDER BY in a
-- single index scan.
CREATE INDEX "notifications_user_id_read_created_at_idx" ON "notifications"("user_id", "read", "created_at" DESC);

-- Backup: "show me my full notification history" — used by the
-- notifications page, no read filter.
CREATE INDEX "notifications_user_id_created_at_idx" ON "notifications"("user_id", "created_at" DESC);
