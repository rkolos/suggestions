-- CreateTable
CREATE TABLE "companies_config" (
    "companyId" UUID NOT NULL,
    "discordGuildId" TEXT,
    "suggestionsChannelId" TEXT,
    "categories" JSONB DEFAULT '[]',
    "notificationTemplates" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "companies_config_pkey" PRIMARY KEY ("companyId")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "companies_config_discordGuildId_key" ON "companies_config"("discordGuildId");
