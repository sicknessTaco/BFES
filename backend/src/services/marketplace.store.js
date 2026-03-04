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
  const clean = { games: next.games || [], coupons: next.coupons || [] };
  fs.writeFileSync(storePath, JSON.stringify(clean, null, 2), "utf8");
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
