import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.resolve(__dirname, "../../data");
const storePath = path.join(dataDir, "memberships.json");

function ensureStore() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(storePath)) fs.writeFileSync(storePath, JSON.stringify({ users: [] }, null, 2), "utf8");
}

function readStore() {
  ensureStore();
  const raw = fs.readFileSync(storePath, "utf8");
  const parsed = JSON.parse(String(raw || "").replace(/^\uFEFF/, ""));
  if (!Array.isArray(parsed.users)) parsed.users = [];
  return parsed;
}

function writeStore(next) {
  ensureStore();
  fs.writeFileSync(storePath, JSON.stringify(next, null, 2), "utf8");
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function hashPassword(password, saltHex) {
  const salt = saltHex ? Buffer.from(saltHex, "hex") : crypto.randomBytes(16);
  const hash = crypto.scryptSync(String(password), salt, 64).toString("hex");
  return { salt: salt.toString("hex"), hash };
}

export function registerMembershipUser(email, password, membershipInfo) {
  const userEmail = normalizeEmail(email);
  if (!userEmail) throw new Error("email is required");
  if (String(password || "").length < 8) throw new Error("password must be at least 8 characters");

  const state = readStore();
  const idx = state.users.findIndex((item) => item.email === userEmail);
  const pwd = hashPassword(password);

  const nextUser = {
    email: userEmail,
    salt: pwd.salt,
    passwordHash: pwd.hash,
    membership: {
      active: true,
      planId: membershipInfo.planId || "unknown",
      sessionId: membershipInfo.sessionId,
      activatedAt: new Date().toISOString()
    }
  };

  if (idx >= 0) state.users[idx] = nextUser;
  else state.users.push(nextUser);

  writeStore(state);
  return { email: nextUser.email, membership: nextUser.membership };
}

export function loginMembershipUser(email, password) {
  const userEmail = normalizeEmail(email);
  const state = readStore();
  const user = state.users.find((item) => item.email === userEmail);
  if (!user) return null;

  const { hash } = hashPassword(password, user.salt);
  if (!crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(user.passwordHash, "hex"))) return null;

  return { email: user.email, membership: user.membership };
}

export function getMembershipUser(email) {
  const userEmail = normalizeEmail(email);
  const state = readStore();
  const user = state.users.find((item) => item.email === userEmail);
  if (!user) return null;
  return { email: user.email, membership: user.membership };
}
