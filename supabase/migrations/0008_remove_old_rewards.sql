-- Remove the obsolete rewards system.
-- Migration 0002 is intentionally kept as history.
BEGIN;

DROP TABLE IF EXISTS aura_reward_order_exclusions;
DROP TABLE IF EXISTS aura_reward_credit_review_incidents;
DROP TABLE IF EXISTS aura_reward_credit_restorations;
DROP TABLE IF EXISTS aura_reward_credit_uses;
DROP TABLE IF EXISTS aura_reward_incidents;
DROP TABLE IF EXISTS aura_reward_grant_orders;
DROP TABLE IF EXISTS aura_reward_grants;
DROP TABLE IF EXISTS aura_reward_reset_orders;
DROP TABLE IF EXISTS aura_reward_definitions;
DROP TABLE IF EXISTS aura_reward_settings;

COMMIT;
