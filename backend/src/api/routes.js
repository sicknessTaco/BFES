import { Router } from "express";
import jwt from "jsonwebtoken";
import {
  addAdminUser,
  authenticateAdmin,
  listAdminUsers,
  removeAdminUser
} from "../services/admin-auth.store.js";
import { createGameCheckout, createCartCheckout, createMembershipCheckout, confirmCheckoutSession, getCheckoutSessionDetails } from "../services/stripe.service.js";
import { createDownloadToken, getDownloadableFiles, verifyDownloadToken } from "../services/download.service.js";
import {
  addCoupon,
  addMarketplaceGame,
  addMembership,
  getMarketplaceCatalog,
  listCoupons,
  listMemberships,
  removeCoupon,
  removeMarketplaceGame,
  removeMembership,
  updateCoupon,
  updateMarketplaceGame,
  updateMembership
} from "../services/marketplace.store.js";
import { getMembershipUser, listMembershipAccounts, listMembershipLogs, loginMembershipUser, registerMembershipUser } from "../services/member.store.js";

export const apiRouter = Router();
const ADMIN_TOKEN_TTL = "7d";
const MEMBER_TOKEN_TTL = "14d";

function adminJwtSecret() {
  return process.env.ADMIN_JWT_SECRET || process.env.DOWNLOAD_TOKEN_SECRET || "change_me_admin_jwt";
}

function memberJwtSecret() {
  return process.env.MEMBER_JWT_SECRET || process.env.DOWNLOAD_TOKEN_SECRET || "change_me_member_jwt";
}

function getClientDeviceId(req) {
  return String(req.headers["x-client-device-id"] || "").trim();
}

function signAdminToken(username, deviceId) {
  return jwt.sign({ role: "admin", username, deviceId }, adminJwtSecret(), { expiresIn: ADMIN_TOKEN_TTL });
}

function signMemberToken(email, deviceId) {
  return jwt.sign({ role: "member", email, deviceId }, memberJwtSecret(), { expiresIn: MEMBER_TOKEN_TTL });
}

function requireAdmin(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) return res.status(401).json({ error: "admin token required" });

  try {
    const payload = jwt.verify(token, adminJwtSecret());
    if (payload.role !== "admin") return res.status(403).json({ error: "invalid admin token" });
    const deviceId = getClientDeviceId(req);
    if (!deviceId || payload.deviceId !== deviceId) {
      return res.status(401).json({ error: "admin token invalid for this device" });
    }
    req.admin = payload;
    return next();
  } catch {
    return res.status(401).json({ error: "invalid or expired admin token" });
  }
}

function requireOwner(req, res, next) {
  if (req.admin?.username !== "knoir") {
    return res.status(403).json({ error: "only knoir can manage users" });
  }
  return next();
}

function requireMember(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) return res.status(401).json({ error: "member token required" });

  try {
    const payload = jwt.verify(token, memberJwtSecret());
    if (payload.role !== "member") return res.status(403).json({ error: "invalid member token" });
    const deviceId = getClientDeviceId(req);
    if (!deviceId || payload.deviceId !== deviceId) {
      return res.status(401).json({ error: "member token invalid for this device" });
    }
    req.member = payload;
    return next();
  } catch {
    return res.status(401).json({ error: "invalid or expired member token" });
  }
}

apiRouter.get("/health", (req, res) => {
  res.json({ ok: true, service: "blackforge-api" });
});

apiRouter.get("/catalog", (req, res) => {
  const catalog = getMarketplaceCatalog();
  res.json(catalog);
});

apiRouter.get("/contact/config", (req, res) => {
  res.json({
    publicKey: process.env.EMAILJS_PUBLIC_KEY || "",
    serviceId: process.env.EMAILJS_SERVICE_ID || "",
    templateId: process.env.EMAILJS_TEMPLATE_ID || "",
    toName: process.env.EMAILJS_TO_NAME || "BlackForge Support",
    toEmail: process.env.EMAILJS_TO_EMAIL || "support@blackforge.dev"
  });
});

apiRouter.post("/admin/auth/login", (req, res) => {
  try {
    const { username, password } = req.body || {};
    const deviceId = getClientDeviceId(req);
    if (!deviceId) return res.status(400).json({ error: "device id is required" });
    if (!authenticateAdmin(username, password)) {
      return res.status(401).json({ error: "invalid credentials" });
    }

    const token = signAdminToken(String(username).trim().toLowerCase(), deviceId);
    return res.json({ ok: true, token });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

apiRouter.get("/admin/auth/session", requireAdmin, (req, res) => {
  return res.json({ ok: true, admin: { username: req.admin.username } });
});

apiRouter.get("/admin/auth/users", requireAdmin, (req, res) => {
  return res.json({ users: listAdminUsers() });
});

apiRouter.post("/admin/auth/users", requireAdmin, requireOwner, (req, res) => {
  try {
    const { username, password } = req.body || {};
    addAdminUser(username, password);
    return res.status(201).json({ ok: true });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

apiRouter.delete("/admin/auth/users/:username", requireAdmin, requireOwner, (req, res) => {
  try {
    removeAdminUser(req.params.username);
    return res.json({ ok: true });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

apiRouter.get("/admin/marketplace", requireAdmin, (req, res) => {
  res.json(getMarketplaceCatalog());
});

apiRouter.post("/admin/marketplace/games", requireAdmin, (req, res) => {
  try {
    const game = addMarketplaceGame(req.body || {});
    return res.status(201).json({ ok: true, game });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

apiRouter.put("/admin/marketplace/games/:gameId", requireAdmin, (req, res) => {
  try {
    const game = updateMarketplaceGame(req.params.gameId, req.body || {});
    return res.json({ ok: true, game });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

apiRouter.delete("/admin/marketplace/games/:gameId", requireAdmin, (req, res) => {
  try {
    removeMarketplaceGame(req.params.gameId);
    return res.json({ ok: true });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

apiRouter.get("/admin/marketplace/memberships", requireAdmin, (req, res) => {
  return res.json({ memberships: listMemberships() });
});

apiRouter.post("/admin/marketplace/memberships", requireAdmin, (req, res) => {
  try {
    const membership = addMembership(req.body || {});
    return res.status(201).json({ ok: true, membership });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

apiRouter.put("/admin/marketplace/memberships/:planId", requireAdmin, (req, res) => {
  try {
    const membership = updateMembership(req.params.planId, req.body || {});
    return res.json({ ok: true, membership });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

apiRouter.delete("/admin/marketplace/memberships/:planId", requireAdmin, (req, res) => {
  try {
    removeMembership(req.params.planId);
    return res.json({ ok: true });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

apiRouter.get("/admin/marketplace/coupons", requireAdmin, (req, res) => {
  return res.json({ coupons: listCoupons() });
});

apiRouter.post("/admin/marketplace/coupons", requireAdmin, (req, res) => {
  try {
    const coupon = addCoupon(req.body || {});
    return res.status(201).json({ ok: true, coupon });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

apiRouter.put("/admin/marketplace/coupons/:code", requireAdmin, (req, res) => {
  try {
    const coupon = updateCoupon(req.params.code, req.body || {});
    return res.json({ ok: true, coupon });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

apiRouter.delete("/admin/marketplace/coupons/:code", requireAdmin, (req, res) => {
  try {
    removeCoupon(req.params.code);
    return res.json({ ok: true });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});


apiRouter.get("/admin/membership/accounts", requireAdmin, (req, res) => {
  try {
    const planId = req.query.planId;
    const data = listMembershipAccounts({ planId });
    return res.json({ ok: true, ...data });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

apiRouter.get("/admin/membership/logs", requireAdmin, (req, res) => {
  try {
    const planId = req.query.planId;
    const limit = req.query.limit;
    const logs = listMembershipLogs({ planId, limit });
    return res.json({ ok: true, logs });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});
apiRouter.post("/membership/register", async (req, res) => {
  try {
    const { sessionId, email, password } = req.body || {};
    const deviceId = getClientDeviceId(req);
    if (!deviceId) return res.status(400).json({ error: "device id is required" });
    if (!sessionId) return res.status(400).json({ error: "sessionId is required" });

    const session = await getCheckoutSessionDetails(sessionId);
    const paid = session.payment_status === "paid" || session.status === "complete";
    if (!paid) return res.status(402).json({ error: "membership payment not confirmed" });
    if (session.metadata?.purchaseType !== "membership") {
      return res.status(400).json({ error: "this checkout is not a membership" });
    }

    const user = registerMembershipUser(email, password, {
      planId: session.metadata?.planId || "unknown",
      sessionId
    }, deviceId);

    const token = signMemberToken(user.email, deviceId);
    return res.json({ ok: true, token, user });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

apiRouter.post("/membership/login", (req, res) => {
  try {
    const { email, password } = req.body || {};
    const deviceId = getClientDeviceId(req);
    if (!deviceId) return res.status(400).json({ error: "device id is required" });
    const user = loginMembershipUser(email, password, deviceId);
    if (!user) return res.status(401).json({ error: "invalid credentials" });

    const token = signMemberToken(user.email, deviceId);
    return res.json({ ok: true, token, user });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

apiRouter.get("/membership/me", requireMember, (req, res) => {
  const user = getMembershipUser(req.member.email);
  if (!user) return res.status(404).json({ error: "membership user not found" });
  return res.json({ ok: true, user });
});

apiRouter.get("/membership/downloads", requireMember, (req, res) => {
  try {
    const user = getMembershipUser(req.member.email);
    if (!user) return res.status(404).json({ error: "membership user not found" });
    if (!user.membership?.active) return res.status(403).json({ error: "membership inactive" });

    const catalog = getMarketplaceCatalog();
    const plan = (catalog.memberships || []).find((item) => item.id === user.membership.planId);
    const access = Array.isArray(plan?.downloadAccessGameIds) && plan.downloadAccessGameIds.length
      ? plan.downloadAccessGameIds
      : ["all"];
    const allowedIds = access.some((id) => String(id).toLowerCase() === "all" || id === "*") ? null : access;

    const files = getDownloadableFiles({
      type: "membership",
      itemIds: allowedIds || undefined
    });
    const downloads = files.map((file) => ({
      id: file.id,
      name: file.name,
      url: `/api/download/${file.id}?token=${encodeURIComponent(createDownloadToken(file.id))}`
    }));

    return res.json({
      ok: true,
      planId: user.membership.planId,
      access: allowedIds || ["all"],
      downloads
    });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

apiRouter.post("/checkout/game", async (req, res) => {
  try {
    const { gameId, couponCode } = req.body || {};
    if (!gameId) return res.status(400).json({ error: "gameId is required" });

    const session = await createGameCheckout(gameId, couponCode);
    return res.json({ id: session.id, url: session.url });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

apiRouter.post("/checkout/cart", async (req, res) => {
  try {
    const { gameIds, couponCode } = req.body || {};
    if (!Array.isArray(gameIds) || gameIds.length === 0) {
      return res.status(400).json({ error: "gameIds array is required" });
    }

    const session = await createCartCheckout(gameIds, couponCode);
    return res.json({ id: session.id, url: session.url });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

apiRouter.post("/checkout/membership", async (req, res) => {
  try {
    const { planId } = req.body;
    if (!planId) return res.status(400).json({ error: "planId is required" });

    const session = await createMembershipCheckout(planId);
    return res.json({ id: session.id, url: session.url });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

apiRouter.get("/checkout/confirm", async (req, res) => {
  try {
    const sessionId = req.query.session_id;
    if (!sessionId) return res.status(400).json({ error: "session_id is required" });

    const result = await confirmCheckoutSession(sessionId);
    if (!result.paid) {
      return res.status(402).json({ error: "Payment not confirmed yet" });
    }

    const files = getDownloadableFiles(result);
    const downloads = files.map((file) => {
      const token = createDownloadToken(file.id);
      return {
        id: file.id,
        name: file.name,
        url: `/api/download/${file.id}?token=${encodeURIComponent(token)}`
      };
    });

    return res.json({ paid: true, type: result.type, downloads });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

apiRouter.get("/download/:gameId", (req, res) => {
  try {
    const { gameId } = req.params;
    const { token } = req.query;

    if (!token || typeof token !== "string") {
      return res.status(401).json({ error: "Download token is required" });
    }

    const payload = verifyDownloadToken(token);
    if (payload.gameId !== gameId) {
      return res.status(403).json({ error: "Token does not match requested file" });
    }

    const file = getDownloadableFiles({ type: "direct", itemIds: [gameId] })[0];
    if (!file) return res.status(404).json({ error: "File not found" });

    return res.download(file.path, `${file.id}.zip`);
  } catch (error) {
    return res.status(401).json({ error: error.message });
  }
});



