-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "is_blacklisted" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);
INSERT INTO "new_User" ("created_at", "email", "id", "is_blacklisted", "name", "role") SELECT "created_at", "email", "id", "is_blacklisted", "name", "role" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
