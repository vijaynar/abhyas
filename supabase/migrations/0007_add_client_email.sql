-- Migration: 0007_add_client_email.sql
-- Adds business email to tenants table.

ALTER TABLE tenants ADD COLUMN email VARCHAR(255);
