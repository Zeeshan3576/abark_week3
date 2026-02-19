PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

-- CreateTable
CREATE TABLE "Role" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- Seed baseline roles
INSERT INTO "Role" ("name") VALUES ('USER');
INSERT INTO "Role" ("name") VALUES ('ADMIN');

-- RedefineTables
CREATE TABLE "new_User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL DEFAULT '',
    "roleId" INTEGER NOT NULL,
    CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

INSERT INTO "new_User" ("id", "name", "email", "passwordHash", "roleId")
SELECT
    "User"."id",
    "User"."name",
    "User"."email",
    '',
    COALESCE(
      (SELECT "Role"."id" FROM "Role" WHERE "Role"."name" = "User"."role"),
      (SELECT "Role"."id" FROM "Role" WHERE "Role"."name" = 'USER')
    )
FROM "User";

DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "User_roleId_idx" ON "User"("roleId");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
