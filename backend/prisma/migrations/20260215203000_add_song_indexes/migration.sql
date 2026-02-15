-- CreateIndex
CREATE INDEX "Song_type_status_created_at_idx" ON "Song"("type", "status", "created_at");

-- CreateIndex
CREATE INDEX "Song_type_status_play_date_idx" ON "Song"("type", "status", "play_date");

-- CreateIndex
CREATE INDEX "Song_user_id_created_at_idx" ON "Song"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "Song_video_id_type_status_created_at_idx" ON "Song"("video_id", "type", "status", "created_at");
