-- AlterTable
ALTER TABLE "suggestions" ADD COLUMN "images" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
