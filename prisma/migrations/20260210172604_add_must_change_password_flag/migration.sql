-- Migration: add mustChangePassword flag to User
ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "mustChangePassword" boolean NOT NULL DEFAULT false;
