import Stripe from "stripe";
import { getMarketplaceCatalog } from "./marketplace.store.js";

const stripeKey = process.env.STRIPE_SECRET_KEY;
if (!stripeKey) {
  console.warn("STRIPE_SECRET_KEY is missing. Checkout endpoints will fail until you configure it.");
}

const stripe = new Stripe(stripeKey || "sk_test_placeholder");
const frontendUrl = process.env.FRONTEND_URL || "http://localhost:4000";
const currency = process.env.STRIPE_GAME_PRICE_CURRENCY || "usd";
const forceStripePriceIds = String(process.env.STRIPE_FORCE_PRICE_IDS || "false").toLowerCase() === "true";

function assertStripeConfigured() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("Stripe is not configured. Set STRIPE_SECRET_KEY in backend/.env");
  }
}

function toCents(amount) {
  return Math.max(1, Math.round(Number(amount) * 100));
}

function isCouponExpired(expires) {
  if (!expires) return false;
  const date = new Date(`${expires}T23:59:59.999Z`);
  if (Number.isNaN(date.getTime())) return false;
  return Date.now() > date.getTime();
}

function resolveCoupon(catalog, couponCode) {
  const code = String(couponCode || "").trim().toUpperCase();
  if (!code) return null;

  const coupon = (catalog.coupons || []).find((item) => String(item.code || "").toUpperCase() === code);
  if (!coupon) throw new Error("Coupon not found");
  if (coupon.active === false) throw new Error("Coupon inactive");
  if (isCouponExpired(coupon.expires)) throw new Error("Coupon expired");

  return coupon;
}

function discountFromCoupon(subtotalCents, coupon) {
  if (!coupon) return 0;

  if (coupon.type === "percent") {
    const raw = Math.round(subtotalCents * (Number(coupon.value) / 100));
    return Math.max(0, Math.min(raw, subtotalCents - 1));
  }

  const raw = Math.round(Number(coupon.value) * 100);
  return Math.max(0, Math.min(raw, subtotalCents - 1));
}

function distributeDiscount(unitAmounts, discountCents) {
  if (!discountCents || !unitAmounts.length) return unitAmounts;

  const discounted = [...unitAmounts];
  const originalSubtotal = unitAmounts.reduce((acc, amount) => acc + amount, 0);
  let remaining = discountCents;

  const provisional = discounted.map((amount) => {
    const proportional = Math.floor((discountCents * amount) / originalSubtotal);
    return Math.min(proportional, amount - 1);
  });

  for (let i = 0; i < discounted.length; i += 1) {
    discounted[i] -= provisional[i];
    remaining -= provisional[i];
  }

  while (remaining > 0) {
    let changed = false;

    for (let i = 0; i < discounted.length && remaining > 0; i += 1) {
      if (discounted[i] > 1) {
        discounted[i] -= 1;
        remaining -= 1;
        changed = true;
      }
    }

    if (!changed) break;
  }

  return discounted;
}

function createUnitLineItems(games, coupon) {
  const unitItems = games.map((game) => ({
    game,
    unitAmount: toCents(game.price)
  }));

  const subtotalCents = unitItems.reduce((acc, item) => acc + item.unitAmount, 0);
  const discountCents = discountFromCoupon(subtotalCents, coupon);
  const discountedAmounts = distributeDiscount(unitItems.map((item) => item.unitAmount), discountCents);

  return {
    subtotalCents,
    discountCents,
    lineItems: unitItems.map((item, index) => ({
      price_data: {
        currency,
        product_data: {
          name: item.game.title,
          description: item.game.description
        },
        unit_amount: discountedAmounts[index]
      },
      quantity: 1
    }))
  };
}

function stripeInterval(interval) {
  const value = String(interval || "").toLowerCase();
  return ["ano", "año", "year", "annual", "yearly"].includes(value) ? "year" : "month";
}

function membershipLineItem(plan) {
  if (forceStripePriceIds && plan.stripePriceId && !plan.stripePriceId.startsWith("price_pass_")) {
    return { price: plan.stripePriceId, quantity: 1 };
  }

  return {
    price_data: {
      currency,
      product_data: {
        name: `${plan.name} ${plan.interval}`
      },
      recurring: {
        interval: stripeInterval(plan.interval)
      },
      unit_amount: toCents(plan.price)
    },
    quantity: 1
  };
}

export async function getCheckoutSessionDetails(sessionId) {
  assertStripeConfigured();
  return stripe.checkout.sessions.retrieve(sessionId);
}

export async function createGameCheckout(gameId, couponCode) {
  assertStripeConfigured();
  const catalog = getMarketplaceCatalog();

  const game = catalog.games.find((item) => item.id === gameId);
  if (!game) throw new Error("Game not found");

  const coupon = resolveCoupon(catalog, couponCode);
  if (coupon && forceStripePriceIds && game.stripePriceId && !game.stripePriceId.startsWith("price_game_")) {
    throw new Error("Coupons with STRIPE_FORCE_PRICE_IDS require dynamic price mode. Set STRIPE_FORCE_PRICE_IDS=false");
  }

  const pricing = createUnitLineItems([game], coupon);

  return stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: pricing.lineItems,
    success_url: `${frontendUrl}/success.html?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${frontendUrl}/index.html#juegos`,
    metadata: {
      purchaseType: "game",
      gameIds: game.id,
      couponCode: coupon?.code || "",
      discountCents: String(pricing.discountCents || 0)
    }
  });
}

export async function createCartCheckout(gameIds, couponCode) {
  assertStripeConfigured();
  const catalog = getMarketplaceCatalog();

  if (!Array.isArray(gameIds) || gameIds.length === 0) {
    throw new Error("gameIds must be a non-empty array");
  }

  const games = gameIds
    .map((id) => catalog.games.find((item) => item.id === id))
    .filter(Boolean);

  if (games.length === 0) {
    throw new Error("No valid games in cart");
  }

  const coupon = resolveCoupon(catalog, couponCode);
  if (coupon && forceStripePriceIds) {
    throw new Error("Coupons with STRIPE_FORCE_PRICE_IDS require dynamic price mode. Set STRIPE_FORCE_PRICE_IDS=false");
  }

  const pricing = createUnitLineItems(games, coupon);

  return stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: pricing.lineItems,
    success_url: `${frontendUrl}/success.html?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${frontendUrl}/juegos.html`,
    metadata: {
      purchaseType: "cart",
      gameIds: games.map((game) => game.id).join(","),
      couponCode: coupon?.code || "",
      discountCents: String(pricing.discountCents || 0)
    }
  });
}

export async function createMembershipCheckout(planId) {
  assertStripeConfigured();
  const catalog = getMarketplaceCatalog();

  const plan = catalog.memberships.find((item) => item.id === planId);
  if (!plan) throw new Error("Membership plan not found");

  return stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [membershipLineItem(plan)],
    success_url: `${frontendUrl}/membership-success.html?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${frontendUrl}/membresia.html`,
    metadata: {
      purchaseType: "membership",
      planId: plan.id
    }
  });
}

export async function confirmCheckoutSession(sessionId) {
  assertStripeConfigured();
  const catalog = getMarketplaceCatalog();

  const session = await stripe.checkout.sessions.retrieve(sessionId);
  const paid = session.payment_status === "paid" || session.status === "complete";

  if (!paid) {
    return { paid: false };
  }

  if (session.metadata?.purchaseType === "membership") {
    return {
      paid: true,
      type: "membership",
      itemIds: catalog.games.map((game) => game.id)
    };
  }

  return {
    paid: true,
    type: "game",
    itemIds: (session.metadata?.gameIds || "").split(",").filter(Boolean)
  };
}
