-- CreateEnum
CREATE TYPE "SuggestionSource" AS ENUM ('DISCORD', 'WEB');

-- CreateEnum
CREATE TYPE "SuggestionStatus" AS ENUM ('NEW', 'OPEN', 'DUPLICATE', 'PLANNED', 'IN_PROGRESS', 'COMPLETED', 'REJECTED');

-- CreateTable
CREATE TABLE "suggestions" (
    "id" TEXT NOT NULL,
    "companyId" UUID NOT NULL,
    "authorId" TEXT NOT NULL,
    "source" "SuggestionSource" NOT NULL DEFAULT 'WEB',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "isOfficial" BOOLEAN NOT NULL DEFAULT false,
    "status" "SuggestionStatus" NOT NULL DEFAULT 'NEW',
    "slug" TEXT NOT NULL,
    "discordMessageId" TEXT,
    "discordThreadId" TEXT,
    "mergedIntoId" TEXT,
    "ai_summary" TEXT,
    "type" TEXT,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "votes" (
    "userId" TEXT NOT NULL,
    "suggestionId" TEXT NOT NULL,
    "type" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "votes_pkey" PRIMARY KEY ("userId","suggestionId")
);

-- CreateTable
CREATE TABLE "comments" (
    "id" UUID NOT NULL,
    "suggestionId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "isInternal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "banned_users" (
    "companyId" UUID NOT NULL,
    "userId" TEXT NOT NULL,
    "bannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "banned_users_pkey" PRIMARY KEY ("companyId","userId")
);

-- CreateIndex
CREATE INDEX "suggestions_companyId_status_idx" ON "suggestions"("companyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "suggestions_companyId_slug_key" ON "suggestions"("companyId", "slug");

-- AddForeignKey
ALTER TABLE "suggestions" ADD CONSTRAINT "suggestions_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies_config"("companyId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suggestions" ADD CONSTRAINT "suggestions_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suggestions" ADD CONSTRAINT "suggestions_mergedIntoId_fkey" FOREIGN KEY ("mergedIntoId") REFERENCES "suggestions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "votes" ADD CONSTRAINT "votes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "votes" ADD CONSTRAINT "votes_suggestionId_fkey" FOREIGN KEY ("suggestionId") REFERENCES "suggestions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_suggestionId_fkey" FOREIGN KEY ("suggestionId") REFERENCES "suggestions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "banned_users" ADD CONSTRAINT "banned_users_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies_config"("companyId") ON DELETE CASCADE ON UPDATE CASCADE;
