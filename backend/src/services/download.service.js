import path from "path";
import { fileURLToPath } from "url";
import jwt from "jsonwebtoken";
import { getMarketplaceCatalog } from "./marketplace.store.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const filesRoot = path.resolve(__dirname, "../../files");

const fileMap = new Map([
  ["iron-horizon", { id: "iron-horizon", name: "Iron Horizon", path: path.join(filesRoot, "iron-horizon.zip") }],
  ["neon-rush-2088", { id: "neon-rush-2088", name: "Neon Rush 2088", path: path.join(filesRoot, "neon-rush-2088.zip") }],
  ["echo-protocol", { id: "echo-protocol", name: "Echo Protocol", path: path.join(filesRoot, "echo-protocol.zip") }]
]);

function tokenSecret() {
  const secret = process.env.DOWNLOAD_TOKEN_SECRET;
  if (!secret) throw new Error("DOWNLOAD_TOKEN_SECRET is missing");
  return secret;
}

function tokenTtlMinutes() {
  return Number(process.env.DOWNLOAD_TOKEN_TTL_MINUTES || 60);
}

export function createDownloadToken(gameId) {
  return jwt.sign({ gameId }, tokenSecret(), {
    expiresIn: `${tokenTtlMinutes()}m`
  });
}

export function verifyDownloadToken(token) {
  return jwt.verify(token, tokenSecret());
}

export function getDownloadableFiles(checkoutData) {
  const catalog = getMarketplaceCatalog();

  if (checkoutData.type === "membership") {
    const requestedIds = Array.isArray(checkoutData.itemIds) && checkoutData.itemIds.length
      ? checkoutData.itemIds.map((id) => String(id || "").trim()).filter(Boolean)
      : null;

    const sourceIds = requestedIds || (catalog.games || []).map((game) => game.id);
    const resolved = sourceIds.map((id) => fileMap.get(id)).filter(Boolean);

    if (requestedIds) return resolved;
    if (resolved.length) return resolved;
    return Array.from(fileMap.values());
  }

  return (checkoutData.itemIds || []).map((id) => fileMap.get(id)).filter(Boolean);
}
