import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.resolve(__dirname, "../../data");
const storePath = path.join(dataDir, "memberships.json");
const MAX_LOGS = 3000;

function ensureStore() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(storePath)) {
    fs.writeFileSync(storePath, JSON.stringify({ users: [], logs: [] }, null, 2), "utf8");
  }
}

function readStore() {
  ensureStore();
  const raw = fs.readFileSync(storePath, "utf8");
  const parsed = JSON.parse(String(raw || "").replace(/^\uFEFF/, ""));
  if (!Array.isArray(parsed.users)) parsed.users = [];
  if (!Array.isArray(parsed.logs)) parsed.logs = [];
  return parsed;
}

function writeStore(next) {
  ensureStore();
  if (!Array.isArray(next.logs)) next.logs = [];
  if (next.logs.length > MAX_LOGS) {
    next.logs = next.logs.slice(next.logs.length - MAX_LOGS);
  }
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

function addLog(state, payload) {
  state.logs.push({
    at: new Date().toISOString(),
    action: String(payload.action || "unknown"),
    email: normalizeEmail(payload.email || "unknown"),
    planId: String(payload.planId || "unknown"),
    success: payload.success !== false,
    detail: String(payload.detail || "")
  });
}

function matchPlan(planId, target) {
  if (!planId) return true;
  return String(target || "").trim().toLowerCase() === String(planId).trim().toLowerCase();
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
      activatedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  };

  if (idx >= 0) state.users[idx] = nextUser;
  else state.users.push(nextUser);

  addLog(state, {
    action: "register",
    email: userEmail,
    planId: nextUser.membership.planId,
    success: true,
    detail: idx >= 0 ? "membership updated" : "new account"
  });

  writeStore(state);
  return { email: nextUser.email, membership: nextUser.membership };
}

export function loginMembershipUser(email, password) {
  const userEmail = normalizeEmail(email);
  const state = readStore();
  const user = state.users.find((item) => item.email === userEmail);

  if (!user) {
    addLog(state, {
      action: "login",
      email: userEmail,
      planId: "unknown",
      success: false,
      detail: "user not found"
    });
    writeStore(state);
    return null;
  }

  const { hash } = hashPassword(password, user.salt);
  const ok = crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(user.passwordHash, "hex"));

  addLog(state, {
    action: "login",
    email: userEmail,
    planId: user.membership?.planId || "unknown",
    success: ok,
    detail: ok ? "ok" : "invalid password"
  });

  writeStore(state);

  if (!ok) return null;
  return { email: user.email, membership: user.membership };
}

export function getMembershipUser(email) {
  const userEmail = normalizeEmail(email);
  const state = readStore();
  const user = state.users.find((item) => item.email === userEmail);
  if (!user) return null;
  return { email: user.email, membership: user.membership };
}

export function listMembershipAccounts(filter = {}) {
  const planId = String(filter.planId || "").trim().toLowerCase();
  const state = readStore();
  const users = state.users
    .filter((user) => matchPlan(planId, user.membership?.planId))
    .map((user) => ({
      email: user.email,
      membership: {
        active: Boolean(user.membership?.active),
        planId: user.membership?.planId || "unknown",
        sessionId: user.membership?.sessionId || "",
        activatedAt: user.membership?.activatedAt || "",
        updatedAt: user.membership?.updatedAt || user.membership?.activatedAt || ""
      }
    }))
    .sort((a, b) => (b.membership.activatedAt || "").localeCompare(a.membership.activatedAt || ""));

  const totals = users.reduce((acc, user) => {
    const key = String(user.membership.planId || "unknown").toLowerCase();
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  return { users, totals };
}

export function listMembershipLogs(filter = {}) {
  const planId = String(filter.planId || "").trim().toLowerCase();
  const limit = Math.min(Math.max(Number(filter.limit || 100), 1), 500);
  const state = readStore();

  const logs = state.logs
    .filter((log) => matchPlan(planId, log.planId))
    .slice(-limit)
    .reverse();

  return logs;
}
