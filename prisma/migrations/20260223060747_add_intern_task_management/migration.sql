-- CreateTable
CREATE TABLE "Intern" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "profileImagePath" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Task" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attachmentPath" TEXT,
    "attachmentOriginalName" TEXT,
    "attachmentMimeType" TEXT,
    "internId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Task_internId_fkey" FOREIGN KEY ("internId") REFERENCES "Intern" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Intern_email_key" ON "Intern"("email");

-- CreateIndex
CREATE INDEX "Task_internId_idx" ON "Task"("internId");

-- CreateIndex
CREATE INDEX "Task_status_idx" ON "Task"("status");
