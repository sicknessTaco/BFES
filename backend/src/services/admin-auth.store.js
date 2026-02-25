import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.resolve(__dirname, "../../data");
const storePath = path.join(dataDir, "admin-users.enc.json");
const backupSuffix = ".corrupt";

function credentialsSecret() {
  return process.env.ADMIN_CREDENTIALS_SECRET || process.env.DOWNLOAD_TOKEN_SECRET || "change_me_admin_secret";
}

function keyFromSecret() {
  return crypto.createHash("sha256").update(credentialsSecret()).digest();
}

function encryptObject(payload) {
  const iv = crypto.randomBytes(12);
  const key = keyFromSecret();
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const raw = Buffer.from(JSON.stringify(payload), "utf8");
  const encrypted = Buffer.concat([cipher.update(raw), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    iv: iv.toString("hex"),
    tag: tag.toString("hex"),
    data: encrypted.toString("hex")
  };
}

function decryptObject(payload) {
  const key = keyFromSecret();
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(payload.iv, "hex"));
  decipher.setAuthTag(Buffer.from(payload.tag, "hex"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(payload.data, "hex")),
    decipher.final()
  ]);
  return JSON.parse(decrypted.toString("utf8"));
}

function hashPassword(password, saltHex) {
  const salt = saltHex ? Buffer.from(saltHex, "hex") : crypto.randomBytes(16);
  const derived = crypto.scryptSync(password, salt, 64);
  return {
    salt: salt.toString("hex"),
    hash: derived.toString("hex")
  };
}

function verifyPassword(password, user) {
  const { hash } = hashPassword(password, user.salt);
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(user.passwordHash, "hex"));
}

function seedState() {
  const username = process.env.ADMIN_BOOTSTRAP_USER || "knoir";
  const password = process.env.ADMIN_BOOTSTRAP_PASSWORD || "forgeblast91!";
  return { users: [createUserRecord(username, password)] };
}

function ensureStore() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  if (fs.existsSync(storePath)) return;
  fs.writeFileSync(storePath, JSON.stringify(encryptObject(seedState()), null, 2), "utf8");
}

function recoverStoreFromCorruption() {
  try {
    const backupPath = `${storePath}.${Date.now()}${backupSuffix}`;
    if (fs.existsSync(storePath)) fs.renameSync(storePath, backupPath);
  } catch {}
  fs.writeFileSync(storePath, JSON.stringify(encryptObject(seedState()), null, 2), "utf8");
}

function readStore() {
  ensureStore();
  try {
    const raw = fs.readFileSync(storePath, "utf8");
    const payload = JSON.parse(raw);
    return decryptObject(payload);
  } catch (error) {
    const text = String(error?.message || "");
    const authFailure =
      text.includes("unable to authenticate data") ||
      text.includes("Unsupported state") ||
      text.includes("Unexpected token");

    if (!authFailure) throw error;
    recoverStoreFromCorruption();
    const raw = fs.readFileSync(storePath, "utf8");
    return decryptObject(JSON.parse(raw));
  }
}

function writeStore(next) {
  ensureStore();
  fs.writeFileSync(storePath, JSON.stringify(encryptObject(next), null, 2), "utf8");
}

function normalizeUsername(input) {
  return String(input || "").trim().toLowerCase();
}

export function createUserRecord(username, password) {
  const name = normalizeUsername(username);
  if (!name) throw new Error("username is required");
  if (String(password || "").length < 8) throw new Error("password must be at least 8 characters");
  const pwd = hashPassword(String(password));
  return {
    username: name,
    salt: pwd.salt,
    passwordHash: pwd.hash
  };
}

export function authenticateAdmin(username, password) {
  const name = normalizeUsername(username);
  const state = readStore();
  const user = (state.users || []).find((item) => item.username === name);
  if (!user) return false;
  return verifyPassword(String(password || ""), user);
}

export function addAdminUser(username, password) {
  const state = readStore();
  const next = createUserRecord(username, password);
  if ((state.users || []).some((item) => item.username === next.username)) {
    throw new Error("username already exists");
  }
  state.users = [...(state.users || []), next];
  writeStore(state);
}

export function removeAdminUser(username) {
  const name = normalizeUsername(username);
  if (!name) throw new Error("username is required");
  if (name === "knoir") throw new Error("cannot remove owner user");

  const state = readStore();
  const before = (state.users || []).length;
  state.users = (state.users || []).filter((item) => item.username !== name);
  if (state.users.length === before) throw new Error("user not found");
  writeStore(state);
}

export function listAdminUsers() {
  const state = readStore();
  return (state.users || []).map((item) => ({ username: item.username }));
}
