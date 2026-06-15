// pack-core.js — Core plant catalog (all original ~170 stickers)
// Loaded eagerly at boot. Backward-compatible with all existing saved gardens.
// Do NOT remove or rename any keys — saves reference keys directly.

export const PACK_ID = 'core';

// Re-exports the full existing catalog unchanged.
// Source of truth remains usePlantCatalog.js — this file just re-exports for the pack system.
export { PLANT_CATALOG as entries } from '../../hooks/usePlantCatalog.js';
