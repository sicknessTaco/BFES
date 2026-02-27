import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { catalog as defaultCatalog } from "./catalog.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.resolve(__dirname, "../../data");
const storePath = path.join(dataDir, "marketplace.json");
const backupSuffix = ".corrupt";

function defaultCoupons() {
  return [
    {
      code: "FORJA10",
      type: "percent",
      value: 10,
      description: "10% de descuento en juegos del marketplace",
      active: true,
      visible: true,
      expires: "2026-12-31"
    },
    {
      code: "NUEVO5",
      type: "fixed",
      value: 5,
      description: "$5 USD de descuento en compra total",
      active: true,
      visible: true,
      expires: "2026-08-31"
    }
  ];
}

function seedState() {
  return {
    games: defaultCatalog.games,
    memberships: defaultCatalog.memberships,
    coupons: defaultCoupons()
  };
}

function sanitizeJson(text) {
  return String(text || "").replace(/^\uFEFF/, "");
}

function ensureStore() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(storePath)) fs.writeFileSync(storePath, JSON.stringify(seedState(), null, 2), "utf8");
}

function readStore() {
  ensureStore();
  try {
    const raw = fs.readFileSync(storePath, "utf8");
    const parsed = JSON.parse(sanitizeJson(raw));
    if (!Array.isArray(parsed.games)) parsed.games = [];
    if (!Array.isArray(parsed.memberships)) parsed.memberships = defaultCatalog.memberships;
    if (!Array.isArray(parsed.coupons)) parsed.coupons = defaultCoupons();
    return parsed;
  } catch {
    try {
      const backupPath = `${storePath}.${Date.now()}${backupSuffix}`;
      if (fs.existsSync(storePath)) fs.renameSync(storePath, backupPath);
    } catch {}
    const seed = seedState();
    fs.writeFileSync(storePath, JSON.stringify(seed, null, 2), "utf8");
    return seed;
  }
}

function writeStore(next) {
  ensureStore();
  fs.writeFileSync(storePath, JSON.stringify(next, null, 2), "utf8");
}

function normalizeGame(input) {
  const id = String(input.id || "").trim();
  const title = String(input.title || "").trim();
  const genre = String(input.genre || "").trim();
  const description = String(input.description || "").trim();
  const stripePriceId = String(input.stripePriceId || "").trim();
  const image = String(input.image || "").trim();
  const price = Number(input.price);

  if (!id) throw new Error("id is required");
  if (!title) throw new Error("title is required");
  if (!genre) throw new Error("genre is required");
  if (!description) throw new Error("description is required");
  if (!Number.isFinite(price) || price <= 0) throw new Error("price must be a positive number");

  return {
    id,
    title,
    genre,
    description,
    price,
    stripePriceId: stripePriceId || `price_game_${id}`,
    image: image || `./imagenes/${id}.jpg`
  };
}

function normalizeInterval(interval) {
  const value = String(interval || "").trim().toLowerCase();
  if (["mes", "month", "monthly"].includes(value)) return "mes";
  if (["ano", "año", "year", "yearly", "annual"].includes(value)) return "ano";
  throw new Error("membership interval must be mes or ano");
}

function normalizePerks(perks) {
  if (Array.isArray(perks)) {
    return perks.map((item) => String(item || "").trim()).filter(Boolean);
  }

  return String(perks || "")
    .split(/\r?\n|,|\|/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeDownloadAccess(access) {
  if (Array.isArray(access)) {
    const normalized = access
      .map((item) => String(item || "").trim())
      .filter(Boolean);
    if (!normalized.length) return ["all"];
    if (normalized.some((item) => item.toLowerCase() === "all" || item === "*")) return ["all"];
    return [...new Set(normalized)];
  }

  const raw = String(access || "").trim();
  if (!raw || raw.toLowerCase() === "all" || raw === "*") return ["all"];

  const parsed = raw
    .split(/\r?\n|,|\|/)
    .map((item) => item.trim())
    .filter(Boolean);

  if (!parsed.length) return ["all"];
  if (parsed.some((item) => item.toLowerCase() === "all" || item === "*")) return ["all"];
  return [...new Set(parsed)];
}

function normalizeMembership(input) {
  const id = String(input.id || "").trim();
  const name = String(input.name || "").trim();
  const interval = normalizeInterval(input.interval);
  const price = Number(input.price);
  const stripePriceId = String(input.stripePriceId || "").trim();
  const tier = String(input.tier || "").trim() || "Base";
  const highlight = String(input.highlight || "").trim() || "Membresia editable";
  const perks = normalizePerks(input.perks);
  const downloadAccessGameIds = normalizeDownloadAccess(input.downloadAccessGameIds ?? input.downloadAccess);

  if (!id) throw new Error("membership id is required");
  if (!name) throw new Error("membership name is required");
  if (!Number.isFinite(price) || price <= 0) throw new Error("membership price must be a positive number");

  return {
    id,
    name,
    interval,
    price,
    stripePriceId: stripePriceId || `price_pass_${id}`,
    tier,
    highlight,
    perks,
    downloadAccessGameIds
  };
}

function normalizeCoupon(input) {
  const code = String(input.code || "").trim().toUpperCase();
  const type = String(input.type || "").trim().toLowerCase();
  const value = Number(input.value);
  const description = String(input.description || "").trim();
  const expires = String(input.expires || "").trim();
  const active = input.active !== false;
  const visible = input.visible !== false;

  if (!code) throw new Error("coupon code is required");
  if (type !== "percent" && type !== "fixed") throw new Error("coupon type must be percent or fixed");
  if (!Number.isFinite(value) || value <= 0) throw new Error("coupon value must be positive");

  return {
    code,
    type,
    value,
    description: description || "Cupon editable",
    active,
    visible,
    expires: expires || ""
  };
}

export function getMarketplaceCatalog() {
  return readStore();
}

export function addMarketplaceGame(payload) {
  const nextGame = normalizeGame(payload);
  const current = readStore();

  if (current.games.some((item) => item.id === nextGame.id)) {
    throw new Error("game id already exists");
  }

  current.games.push(nextGame);
  writeStore(current);
  return nextGame;
}

export function removeMarketplaceGame(gameId) {
  const id = String(gameId || "").trim();
  if (!id) throw new Error("gameId is required");

  const current = readStore();
  const before = current.games.length;
  current.games = current.games.filter((item) => item.id !== id);

  if (current.games.length === before) {
    throw new Error("game not found");
  }

  writeStore(current);
}

export function updateMarketplaceGame(gameId, payload) {
  const id = String(gameId || "").trim();
  if (!id) throw new Error("gameId is required");

  const current = readStore();
  const idx = current.games.findIndex((item) => item.id === id);
  if (idx < 0) throw new Error("game not found");

  const merged = { ...current.games[idx], ...payload, id };
  current.games[idx] = normalizeGame(merged);
  writeStore(current);
  return current.games[idx];
}

export function listMemberships() {
  const current = readStore();
  return current.memberships || [];
}

export function addMembership(payload) {
  const next = normalizeMembership(payload);
  const current = readStore();
  if ((current.memberships || []).some((item) => item.id === next.id)) {
    throw new Error("membership id already exists");
  }

  current.memberships = [...(current.memberships || []), next];
  writeStore(current);
  return next;
}

export function updateMembership(planId, payload) {
  const id = String(planId || "").trim();
  if (!id) throw new Error("membership id is required");

  const current = readStore();
  const idx = (current.memberships || []).findIndex((item) => item.id === id);
  if (idx < 0) throw new Error("membership not found");

  const merged = { ...current.memberships[idx], ...payload, id };
  current.memberships[idx] = normalizeMembership(merged);
  writeStore(current);
  return current.memberships[idx];
}

export function removeMembership(planId) {
  const id = String(planId || "").trim();
  if (!id) throw new Error("membership id is required");

  const current = readStore();
  const before = (current.memberships || []).length;
  current.memberships = (current.memberships || []).filter((item) => item.id !== id);
  if (current.memberships.length === before) throw new Error("membership not found");
  writeStore(current);
}

export function listCoupons() {
  const current = readStore();
  return current.coupons || [];
}

export function addCoupon(payload) {
  const next = normalizeCoupon(payload);
  const current = readStore();
  if ((current.coupons || []).some((item) => item.code === next.code)) {
    throw new Error("coupon code already exists");
  }
  current.coupons = [...(current.coupons || []), next];
  writeStore(current);
  return next;
}

export function updateCoupon(code, payload) {
  const originalCode = String(code || "").trim().toUpperCase();
  if (!originalCode) throw new Error("coupon code is required");

  const current = readStore();
  const idx = (current.coupons || []).findIndex((item) => item.code === originalCode);
  if (idx < 0) throw new Error("coupon not found");

  const merged = { ...current.coupons[idx], ...payload, code: originalCode };
  current.coupons[idx] = normalizeCoupon(merged);
  writeStore(current);
  return current.coupons[idx];
}

export function removeCoupon(code) {
  const currentCode = String(code || "").trim().toUpperCase();
  if (!currentCode) throw new Error("coupon code is required");

  const current = readStore();
  const before = (current.coupons || []).length;
  current.coupons = (current.coupons || []).filter((item) => item.code !== currentCode);
  if (current.coupons.length === before) throw new Error("coupon not found");
  writeStore(current);
}
