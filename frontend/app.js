const API = "";
const CART_KEY = "bf_cart_v1";

const EDITABLE = window.BFEditable || {};

const UI = {
  cartTitle: EDITABLE.ui?.cartTitle || "Carrito",
  cartEmpty: EDITABLE.ui?.cartEmpty || "Carrito vacio.",
  cartTotalLabel: EDITABLE.ui?.cartTotalLabel || "Total estimado",
  cartCheckoutLabel: EDITABLE.ui?.cartCheckoutLabel || "Comprar carrito completo",
  cartCheckoutLoading: EDITABLE.ui?.cartCheckoutLoading || "Redirigiendo a Stripe...",
  addToCartLabel: EDITABLE.ui?.addToCartLabel || "Carrito",
  buyNowLabel: EDITABLE.ui?.buyNowLabel || "Comprar",
  removeLabel: EDITABLE.ui?.removeLabel || "Quitar",
  subscribeLabel: EDITABLE.ui?.subscribeLabel || "Suscribirme"
};

const money = (value) => `$${Number(value).toFixed(2)}`;

const state = {
  games: [],
  plans: [],
  coupons: [],
  cart: [],
  appliedCoupon: null
};

const gamesGrid = document.getElementById("games-grid");
const plansGrid = document.getElementById("plans-grid");
const cartItems = document.getElementById("cart-items");
const cartTotal = document.getElementById("cart-total");
const cartCheckoutBtn = document.getElementById("cart-checkout-btn");
const cartCheckoutStatus = document.getElementById("cart-checkout-status");
const cartTitle = document.getElementById("cart-title");
const cartTotalLabel = document.getElementById("cart-total-label");
const couponsGrid = document.getElementById("coupons-grid");
const upcomingGrid = document.getElementById("upcoming-grid");
const couponCodeInput = document.getElementById("coupon-code");
const couponStatus = document.getElementById("coupon-status");

function createRevealObserver() {
  const nodes = document.querySelectorAll("[data-reveal]");
  if (!nodes.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("on");
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });

  nodes.forEach((node) => observer.observe(node));
}

function renderEditableContent() {
  const heroQuote = document.getElementById("editable-hero-quote");
  if (heroQuote) heroQuote.textContent = EDITABLE.home?.heroQuote || "";

  const announce = document.getElementById("editable-announce");
  if (announce) announce.textContent = EDITABLE.home?.announce || "";

  const manifesto = document.getElementById("studio-manifesto");
  if (manifesto) manifesto.textContent = EDITABLE.studio?.manifesto || "";

  if (cartTitle) cartTitle.textContent = UI.cartTitle;
  if (cartTotalLabel) cartTotalLabel.textContent = UI.cartTotalLabel;
  if (cartCheckoutBtn) cartCheckoutBtn.textContent = UI.cartCheckoutLabel;

  const pillars = document.getElementById("studio-pillars");
  if (pillars) {
    pillars.innerHTML = (EDITABLE.studio?.pillars || []).map((item) => `
      <article class="bg-black/20 border border-white/10 rounded-2xl p-4">
        <h2 class="font-display text-xl text-red-300">Pilar</h2>
        <p class="text-zinc-300 mt-2">${item}</p>
      </article>
    `).join("");
  }

  const homeUniverse = document.getElementById("home-universe-cards");
  if (homeUniverse) {
    homeUniverse.innerHTML = (EDITABLE.universeCards || []).map((card) => `
      <article class="glass rounded-2xl p-4 border border-red-500/30">
        <p class="text-[10px] tracking-[2px] uppercase text-amber-300">${card.tag || "Lore"}</p>
        <h3 class="font-display text-xl mt-2">${card.title}</h3>
        <p class="text-zinc-300 mt-2 text-sm">${card.text}</p>
      </article>
    `).join("");
  }

  const deepDive = document.getElementById("deep-dive-grid");
  if (deepDive) {
    deepDive.innerHTML = (EDITABLE.gameDeepDives || []).map((item) => `
      <article class="glass rounded-2xl p-4 border border-white/15 hover:border-red-500/60 transition">
        <p class="text-zinc-400 text-xs uppercase tracking-[2px]">${item.gameId}</p>
        <h3 class="font-display text-xl mt-1">${item.subtitle}</h3>
        <ul class="mt-3 text-sm text-zinc-200 list-disc list-inside space-y-1">
          ${(item.highlights || []).map((h) => `<li>${h}</li>`).join("")}
        </ul>
      </article>
    `).join("");
  }

  const roadmap = document.getElementById("roadmap-list");
  if (roadmap) {
    roadmap.innerHTML = (EDITABLE.roadmap || []).map((step) => `
      <article class="glass rounded-2xl p-4 border border-red-500/30">
        <p class="text-amber-300 font-display text-xl">${step.phase}</p>
        <p class="text-zinc-200 mt-2">${step.item}</p>
      </article>
    `).join("");
  }

  if (upcomingGrid) {
    const upcoming = EDITABLE.upcomingGames || [];
    upcomingGrid.innerHTML = upcoming.map((item) => `
      <article class="glass rounded-2xl p-4 border border-white/15">
        <div class="image-slot overflow-hidden">
          <img src="${item.image}" alt="${item.title}" class="w-full h-full object-cover" onerror="this.style.display='none'; this.parentElement.innerHTML='Imagen pendiente';" />
        </div>
        <h3 class="font-display text-xl mt-3">${item.title}</h3>
        <p class="text-zinc-400 text-sm mt-1">Salida estimada: ${item.eta}</p>
        <p class="text-zinc-300 text-sm mt-2">${item.note || "Espacio editable"}</p>
      </article>
    `).join("");
  }
}

function renderCoupons() {
  if (!couponsGrid) return;

  couponsGrid.innerHTML = state.coupons.map((coupon) => {
    const active = coupon.active !== false;
    const badge = active ? "Activo" : "Inactivo";
    const style = active ? "border-emerald-400/40" : "border-zinc-500/30 opacity-70";
    const value = coupon.type === "percent" ? `${coupon.value}%` : `$${coupon.value}`;

    return `
      <article class="glass rounded-2xl p-4 border ${style}">
        <p class="font-display text-xl">${coupon.code}</p>
        <p class="text-zinc-300 text-sm mt-1">${coupon.description || "Cupon editable"}</p>
        <p class="text-zinc-400 text-xs mt-2">Descuento: ${value} | Vence: ${coupon.expires || "N/A"}</p>
        <span class="inline-block mt-2 text-xs px-2 py-1 rounded-full border border-white/20">${badge}</span>
      </article>
    `;
  }).join("");
}

function loadCart() {
  try {
    state.cart = JSON.parse(localStorage.getItem(CART_KEY) || "[]");
  } catch {
    state.cart = [];
  }
}

function saveCart() {
  localStorage.setItem(CART_KEY, JSON.stringify(state.cart));
}

function getCartSummary() {
  const byId = new Map();
  state.cart.forEach((item) => {
    const existing = byId.get(item.id);
    if (existing) {
      existing.quantity += 1;
      return;
    }
    byId.set(item.id, { ...item, quantity: 1 });
  });
  return Array.from(byId.values());
}

function couponDiscount(subtotal) {
  if (!state.appliedCoupon) return 0;
  if (state.appliedCoupon.type === "percent") return subtotal * (state.appliedCoupon.value / 100);
  return state.appliedCoupon.value;
}

function renderCart() {
  if (!cartItems || !cartTotal) return;

  const summary = getCartSummary();

  if (summary.length === 0) {
    cartItems.innerHTML = `<li class="text-zinc-400">${UI.cartEmpty}</li>`;
    cartTotal.textContent = "$0.00";
    if (cartCheckoutBtn) cartCheckoutBtn.disabled = true;
    return;
  }

  cartItems.innerHTML = summary
    .map((item) => {
      const lineTotal = item.price * item.quantity;
      return `
      <li class="flex justify-between gap-2 border-b border-white/10 pb-2">
        <span>${item.title} x${item.quantity} <span class="text-zinc-400">(${money(lineTotal)})</span></span>
        <button data-remove-id="${item.id}" class="text-red-400 hover:text-red-300">${UI.removeLabel}</button>
      </li>
    `;
    })
    .join("");

  const subtotal = state.cart.reduce((acc, item) => acc + item.price, 0);
  const discount = Math.min(couponDiscount(subtotal), subtotal);
  const total = subtotal - discount;

  cartTotal.textContent = money(total);
  if (couponStatus && state.appliedCoupon) {
    couponStatus.textContent = `Cupon aplicado: ${state.appliedCoupon.code} (-${money(discount)})`;
  }

  if (cartCheckoutBtn) cartCheckoutBtn.disabled = false;
}

function renderGames() {
  if (!gamesGrid) return;

  gamesGrid.innerHTML = state.games
    .map((game, index) => `
      <article class="glass rounded-2xl p-4 border border-white/10 animate-appear hover:border-red-500/60 hover:shadow-[0_0_30px_rgba(216,11,23,.25)] transition duration-300" style="animation-delay:${index * 80}ms">
        <div class="image-slot mb-3 overflow-hidden">
          <img src="${game.image || `./imagenes/${game.id}.jpg`}" alt="${game.title}" class="w-full h-full object-cover" onerror="this.style.display='none'; this.parentElement.innerHTML='Imagen pendiente';" />
        </div>
        <p class="text-red-300 text-xs tracking-[2px] uppercase">${game.genre}</p>
        <h3 class="font-display text-xl mt-1">${game.title}</h3>
        <p class="text-zinc-300 mt-2 text-sm">${game.description}</p>
        <div class="mt-4 flex gap-2 items-center justify-between">
          <strong class="font-display text-xl">${money(game.price)}</strong>
          <div class="flex gap-2">
            <button data-add="${game.id}" class="px-3 py-2 rounded-lg border border-white/20 hover:border-red-400">${UI.addToCartLabel}</button>
            <button data-buy="${game.id}" class="px-3 py-2 rounded-lg bg-red-600 hover:bg-red-500">${UI.buyNowLabel}</button>
          </div>
        </div>
      </article>
    `)
    .join("");
}

function renderPlans() {
  if (!plansGrid) return;

  plansGrid.innerHTML = state.plans
    .map((plan, index) => {
      const pro = plan.name.toLowerCase().includes("nocturna") || (plan.tier || "").toLowerCase() === "pro";
      const glow = pro
        ? "border-red-400/70 shadow-[0_0_45px_rgba(255,40,40,.35)]"
        : "border-amber-300/40 shadow-[0_0_35px_rgba(255,205,60,.2)]";
      const cta = pro ? "bg-gradient-to-r from-red-700 to-red-500" : "bg-gradient-to-r from-amber-500 to-yellow-300 text-black";
      const badge = pro ? "Pro" : "Base";
      const perks = Array.isArray(plan.perks) && plan.perks.length
        ? plan.perks.map((perk) => `<li>${perk}</li>`).join("")
        : "<li>Acceso completo al catalogo</li><li>Lanzamientos dia 1</li><li>Descuentos exclusivos</li>";

      return `
      <article class="glass rounded-2xl p-5 border ${glow} animate-appear hover:-translate-y-1 transition duration-300" style="animation-delay:${index * 90}ms">
        <div class="flex items-center justify-between gap-2">
          <p class="text-red-300 text-xs tracking-[2px] uppercase">${plan.interval}</p>
          <span class="text-[11px] uppercase tracking-[1.5px] px-2 py-1 rounded-full bg-black/40 border border-white/20">${badge}</span>
        </div>
        <h3 class="font-display text-2xl mt-2">${plan.name}</h3>
        <p class="text-zinc-300 text-sm mt-1">${plan.highlight || "Membresia premium"}</p>
        <p class="text-3xl mt-3 font-display">${money(plan.price)}<span class="text-base text-zinc-400">/${plan.interval}</span></p>
        <ul class="text-zinc-200 mt-3 space-y-1 text-sm list-disc list-inside">${perks}</ul>
        <button data-subscribe="${plan.id}" class="mt-4 w-full px-4 py-2 rounded-lg ${cta} hover:brightness-110 transition">${UI.subscribeLabel}</button>
      </article>
    `;
    })
    .join("");
}

function applyCoupon(code) {
  const normalized = String(code || "").trim().toUpperCase();
  if (!normalized) {
    state.appliedCoupon = null;
    if (couponStatus) couponStatus.textContent = "Cupon removido.";
    renderCart();
    return;
  }

  const found = state.coupons.find((item) => String(item.code || "").toUpperCase() === normalized && item.active !== false);
  if (!found) {
    state.appliedCoupon = null;
    if (couponStatus) couponStatus.textContent = "Cupon invalido o inactivo.";
    renderCart();
    return;
  }

  state.appliedCoupon = found;
  renderCart();
}

async function createCheckout(path, payload) {
  const response = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "No se pudo crear la sesion de pago.");
  }

  if (data.url) {
    window.location.href = data.url;
  }
}

async function checkoutCart() {
  if (state.cart.length === 0) return;
  const gameIds = state.cart.map((item) => item.id);

  if (cartCheckoutBtn) cartCheckoutBtn.disabled = true;
  if (cartCheckoutStatus) cartCheckoutStatus.textContent = UI.cartCheckoutLoading;

  await createCheckout("/api/checkout/cart", { gameIds, couponCode: state.appliedCoupon?.code || "" });
}

async function init() {
  renderEditableContent();
  createRevealObserver();
  loadCart();
  renderCart();

  const response = await fetch(`${API}/api/catalog`);
  const data = await response.json();
  if (!response.ok) {
    alert(data.error || "No se pudo cargar el catalogo");
    return;
  }

  state.games = data.games || [];
  state.plans = data.memberships || [];
  state.coupons = data.coupons || [];
  renderGames();
  renderPlans();
  renderCoupons();
}

document.addEventListener("click", async (event) => {
  const add = event.target.closest("button[data-add]");
  const buy = event.target.closest("button[data-buy]");
  const removeById = event.target.closest("button[data-remove-id]");
  const subscribe = event.target.closest("button[data-subscribe]");
  const cartCheckout = event.target.closest("button#cart-checkout-btn");
  const applyCouponBtn = event.target.closest("button#apply-coupon-btn");

  try {
    if (add) {
      const game = state.games.find((item) => item.id === add.dataset.add);
      if (!game) return;
      state.cart.push(game);
      saveCart();
      renderCart();
    }

    if (removeById) {
      const id = removeById.dataset.removeId;
      const index = state.cart.findIndex((item) => item.id === id);
      if (index >= 0) {
        state.cart.splice(index, 1);
        saveCart();
        renderCart();
      }
    }

    if (buy) {
      await createCheckout("/api/checkout/game", { gameId: buy.dataset.buy, couponCode: state.appliedCoupon?.code || "" });
    }

    if (cartCheckout) {
      await checkoutCart();
    }

    if (applyCouponBtn) {
      applyCoupon(couponCodeInput?.value || "");
    }

    if (subscribe) {
      await createCheckout("/api/checkout/membership", { planId: subscribe.dataset.subscribe });
    }
  } catch (error) {
    if (cartCheckoutStatus) cartCheckoutStatus.textContent = error.message;
    alert(error.message);
    if (cartCheckoutBtn) cartCheckoutBtn.disabled = false;
  }
});

init();

