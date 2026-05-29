-- Migration: 0006_add_alternate_phone.sql
-- Adds alternate phone number to users table.

ALTER TABLE users ADD COLUMN alternate_phone VARCHAR(20);
