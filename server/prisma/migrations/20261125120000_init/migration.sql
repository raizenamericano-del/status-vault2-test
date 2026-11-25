-- CreateTable
CREATE TABLE "WhatsAppSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "phoneNumber" TEXT,
    "connectionStatus" TEXT NOT NULL DEFAULT 'disconnected',
    "lastConnectedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "StatusMedia" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "whatsappId" TEXT NOT NULL,
    "mediaType" TEXT NOT NULL,
    "contactName" TEXT,
    "contactJid" TEXT,
    "caption" TEXT,
    "mediaPath" TEXT,
    "thumbnailPath" TEXT,
    "mimetype" TEXT,
    "fileSize" INTEGER,
    "timestamp" DATETIME,
    "isSaved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "DownloadHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "statusMediaId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileSize" INTEGER,
    "fileFormat" TEXT,
    "downloadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DownloadHistory_statusMediaId_fkey" FOREIGN KEY ("statusMediaId") REFERENCES "StatusMedia" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AppSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "StatusMedia_whatsappId_key" ON "StatusMedia"("whatsappId");

-- CreateIndex
CREATE INDEX "StatusMedia_mediaType_idx" ON "StatusMedia"("mediaType");

-- CreateIndex
CREATE INDEX "StatusMedia_timestamp_idx" ON "StatusMedia"("timestamp");

-- CreateIndex
CREATE INDEX "StatusMedia_createdAt_idx" ON "StatusMedia"("createdAt");

-- CreateIndex
CREATE INDEX "StatusMedia_contactName_idx" ON "StatusMedia"("contactName");

-- CreateIndex
CREATE INDEX "DownloadHistory_downloadedAt_idx" ON "DownloadHistory"("downloadedAt");

-- CreateIndex
CREATE INDEX "DownloadHistory_statusMediaId_idx" ON "DownloadHistory"("statusMediaId");

-- CreateIndex
CREATE UNIQUE INDEX "AppSettings_key_key" ON "AppSettings"("key");

