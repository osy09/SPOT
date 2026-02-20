-- RedefineTables
-- SQLite does not support DROP COLUMN directly for tables with foreign keys/indexes,
-- so we recreate the Song table without the unused `story` and `is_anonymous` fields.

PRAGMA foreign_keys=OFF;

-- Step 1: Create new table without story and is_anonymous
CREATE TABLE "new_Song" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "youtube_url" TEXT NOT NULL,
    "video_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "channel_name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "play_date" DATETIME,
    "rejected_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Song_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Step 2: Copy existing data
INSERT INTO "new_Song" ("id", "user_id", "type", "youtube_url", "video_id", "title", "channel_name", "status", "play_date", "rejected_at", "created_at")
SELECT "id", "user_id", "type", "youtube_url", "video_id", "title", "channel_name", "status", "play_date", "rejected_at", "created_at"
FROM "Song";

-- Step 3: Swap tables
DROP TABLE "Song";
ALTER TABLE "new_Song" RENAME TO "Song";

-- Step 4: Recreate indexes
CREATE INDEX "Song_type_status_created_at_idx" ON "Song"("type", "status", "created_at");
CREATE INDEX "Song_type_status_play_date_idx" ON "Song"("type", "status", "play_date");
CREATE INDEX "Song_user_id_created_at_idx" ON "Song"("user_id", "created_at");
CREATE INDEX "Song_video_id_type_status_created_at_idx" ON "Song"("video_id", "type", "status", "created_at");

PRAGMA foreign_keys=ON;
