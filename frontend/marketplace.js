const TOKEN_KEY = "bf_admin_token";
const DEVICE_KEY = "bf_device_id";

const API = {
  login: "/api/admin/auth/login",
  session: "/api/admin/auth/session",
  users: "/api/admin/auth/users",
  userDelete: (username) => `/api/admin/auth/users/${encodeURIComponent(username)}`,
  list: "/api/admin/marketplace",
  add: "/api/admin/marketplace/games",
  update: (id) => `/api/admin/marketplace/games/${encodeURIComponent(id)}`,
  remove: (id) => `/api/admin/marketplace/games/${encodeURIComponent(id)}`,
  coupons: "/api/admin/marketplace/coupons",
  couponUpdate: (code) => `/api/admin/marketplace/coupons/${encodeURIComponent(code)}`,
  couponDelete: (code) => `/api/admin/marketplace/coupons/${encodeURIComponent(code)}`
};

const authPanel = document.getElementById("auth-panel");
const adminPanel = document.getElementById("admin-panel");
const loginForm = document.getElementById("login-form");
const authStatus = document.getElementById("auth-status");
const logoutBtn = document.getElementById("logout-btn");

const form = document.getElementById("game-form");
const statusEl = document.getElementById("form-status");
const gamesList = document.getElementById("games-list");
const refreshBtn = document.getElementById("refresh-btn");

const userForm = document.getElementById("user-form");
const userStatus = document.getElementById("user-status");
const usersList = document.getElementById("users-list");
const ownerNote = document.getElementById("owner-only-note");

const couponForm = document.getElementById("coupon-form");
const couponStatus = document.getElementById("coupon-admin-status");
const couponsList = document.getElementById("coupons-admin-list");

let editId = null;
let editCouponCode = null;
let currentAdmin = "";

function clientDeviceId() {
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = (crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`).replace(/\s+/g, "");
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

function token() {
  return localStorage.getItem(TOKEN_KEY) || "";
}

function setToken(value) {
  if (!value) {
    localStorage.removeItem(TOKEN_KEY);
    return;
  }
  localStorage.setItem(TOKEN_KEY, value);
}

function authHeaders() {
  return {
    "Content-Type": "application/json",
    "x-client-device-id": clientDeviceId(),
    Authorization: `Bearer ${token()}`
  };
}

function updateOwnerAccessUI() {
  const isOwner = currentAdmin === "knoir";
  const controls = userForm ? userForm.querySelectorAll("input, button") : [];
  controls.forEach((control) => {
    control.disabled = !isOwner;
  });

  if (ownerNote) {
    ownerNote.textContent = isOwner
      ? "Modo propietario activo."
      : "Modo solo lectura: solo knoir puede crear o eliminar usuarios.";
  }
}

function readForm() {
  return {
    id: document.getElementById("id").value.trim(),
    title: document.getElementById("title").value.trim(),
    genre: document.getElementById("genre").value.trim(),
    description: document.getElementById("description").value.trim(),
    price: Number(document.getElementById("price").value),
    stripePriceId: document.getElementById("stripePriceId").value.trim(),
    image: document.getElementById("image").value.trim()
  };
}

function readCouponForm() {
  return {
    code: document.getElementById("coupon-code-admin").value.trim().toUpperCase(),
    type: document.getElementById("coupon-type-admin").value,
    value: Number(document.getElementById("coupon-value-admin").value),
    expires: document.getElementById("coupon-expires-admin").value.trim(),
    description: document.getElementById("coupon-description-admin").value.trim(),
    active: document.getElementById("coupon-active-admin").checked,
    visible: document.getElementById("coupon-visible-admin").checked
  };
}

function fillForm(game) {
  document.getElementById("id").value = game.id || "";
  document.getElementById("title").value = game.title || "";
  document.getElementById("genre").value = game.genre || "";
  document.getElementById("description").value = game.description || "";
  document.getElementById("price").value = game.price || "";
  document.getElementById("stripePriceId").value = game.stripePriceId || "";
  document.getElementById("image").value = game.image || "";
}

function fillCouponForm(coupon) {
  document.getElementById("coupon-code-admin").value = coupon.code || "";
  document.getElementById("coupon-type-admin").value = coupon.type || "percent";
  document.getElementById("coupon-value-admin").value = coupon.value || "";
  document.getElementById("coupon-expires-admin").value = coupon.expires || "";
  document.getElementById("coupon-description-admin").value = coupon.description || "";
  document.getElementById("coupon-active-admin").checked = coupon.active !== false;
  document.getElementById("coupon-visible-admin").checked = coupon.visible !== false;
}

function resetForm() {
  editId = null;
  form.reset();
}

function resetCouponForm() {
  editCouponCode = null;
  couponForm.reset();
  document.getElementById("coupon-active-admin").checked = true;
  document.getElementById("coupon-visible-admin").checked = true;
}

function setAdminMode(enabled) {
  authPanel.classList.toggle("hidden", enabled);
  adminPanel.classList.toggle("hidden", !enabled);
}

async function request(url, options = {}, useAuth = true) {
  const headers = useAuth ? authHeaders() : { "Content-Type": "application/json", "x-client-device-id": clientDeviceId() };
  const res = await fetch(url, { headers, ...options });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

function gameCard(game) {
  const article = document.createElement("article");
  article.className = "glass rounded-2xl p-4 border border-white/10";
  article.innerHTML = `
    <p class="text-xs text-zinc-400">${game.id}</p>
    <h3 class="font-display text-xl">${game.title}</h3>
    <p class="text-sm text-zinc-300 mt-1">${game.genre}</p>
    <p class="text-sm text-zinc-300 mt-2">${game.description}</p>
    <p class="text-sm text-zinc-400 mt-2">${Number(game.price).toFixed(2)} USD</p>
    <div class="mt-3 flex gap-2">
      <button data-edit="${game.id}" class="px-3 py-2 rounded-lg border border-white/20">Editar</button>
      <button data-delete="${game.id}" class="px-3 py-2 rounded-lg border border-red-500/50 text-red-300">Eliminar</button>
    </div>
  `;
  return article;
}

function couponCard(coupon) {
  const valueLabel = coupon.type === "percent" ? `${coupon.value}%` : `$${coupon.value}`;
  const article = document.createElement("article");
  article.className = "glass rounded-2xl p-4 border border-white/10";
  article.innerHTML = `
    <p class="font-display text-xl">${coupon.code}</p>
    <p class="text-sm text-zinc-300 mt-1">${coupon.description || ""}</p>
    <p class="text-xs text-zinc-400 mt-2">${valueLabel} | ${coupon.active ? "Activo" : "Inactivo"} | ${coupon.visible !== false ? "Visible" : "Oculto"} | ${coupon.expires || "sin fecha"}</p>
    <div class="mt-3 flex gap-2">
      <button data-coupon-edit="${coupon.code}" class="px-3 py-2 rounded-lg border border-white/20">Editar</button>
      <button data-coupon-delete="${coupon.code}" class="px-3 py-2 rounded-lg border border-red-500/50 text-red-300">Eliminar</button>
    </div>
  `;
  return article;
}

async function loadMarketplace() {
  const data = await request(API.list);

  gamesList.innerHTML = "";
  (data.games || []).forEach((game) => gamesList.appendChild(gameCard(game)));

  couponsList.innerHTML = "";
  (data.coupons || []).forEach((coupon) => couponsList.appendChild(couponCard(coupon)));

  return data;
}

async function loadUsers() {
  const data = await request(API.users);
  usersList.innerHTML = (data.users || []).map((u) => {
    const canDelete = currentAdmin === "knoir" && u.username !== "knoir";
    const delBtn = canDelete ? `<button data-user-delete="${u.username}" class="ml-2 text-red-300">x</button>` : "";
    return `<span class="inline-block mr-3 mt-1 px-2 py-1 border border-white/20 rounded">${u.username}${delBtn}</span>`;
  }).join("");
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  try {
    const username = document.getElementById("login-user").value.trim();
    const password = document.getElementById("login-pass").value;
    const data = await request(API.login, { method: "POST", body: JSON.stringify({ username, password }) }, false);
    setToken(data.token);
    authStatus.textContent = "Login correcto.";
    const session = await request(API.session);
    currentAdmin = session.admin.username;
    setAdminMode(true);
    updateOwnerAccessUI();
    await loadMarketplace();
    await loadUsers();
  } catch (error) {
    authStatus.textContent = error.message;
  }
});

logoutBtn.addEventListener("click", () => {
  setToken("");
  currentAdmin = "";
  setAdminMode(false);
  updateOwnerAccessUI();
});

userForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  try {
    const username = document.getElementById("new-user").value.trim();
    const password = document.getElementById("new-pass").value;
    await request(API.users, { method: "POST", body: JSON.stringify({ username, password }) });
    userForm.reset();
    userStatus.textContent = "Acceso creado.";
    await loadUsers();
  } catch (error) {
    userStatus.textContent = error.message;
  }
});

usersList.addEventListener("click", async (event) => {
  const del = event.target.closest("button[data-user-delete]");
  if (!del) return;

  try {
    await request(API.userDelete(del.dataset.userDelete), { method: "DELETE" });
    userStatus.textContent = "Usuario eliminado.";
    await loadUsers();
  } catch (error) {
    userStatus.textContent = error.message;
  }
});

couponForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  try {
    const payload = readCouponForm();
    if (editCouponCode) {
      await request(API.couponUpdate(editCouponCode), { method: "PUT", body: JSON.stringify(payload) });
      couponStatus.textContent = `Cupon actualizado: ${editCouponCode}`;
    } else {
      await request(API.coupons, { method: "POST", body: JSON.stringify(payload) });
      couponStatus.textContent = `Cupon agregado: ${payload.code}`;
    }

    resetCouponForm();
    await loadMarketplace();
  } catch (error) {
    couponStatus.textContent = error.message;
  }
});

couponsList.addEventListener("click", async (event) => {
  const edit = event.target.closest("button[data-coupon-edit]");
  const del = event.target.closest("button[data-coupon-delete]");

  try {
    const data = await loadMarketplace();

    if (del) {
      await request(API.couponDelete(del.dataset.couponDelete), { method: "DELETE" });
      couponStatus.textContent = `Cupon eliminado: ${del.dataset.couponDelete}`;
      await loadMarketplace();
      return;
    }

    if (edit) {
      const coupon = (data.coupons || []).find((item) => item.code === edit.dataset.couponEdit);
      if (!coupon) throw new Error("cupon no encontrado");
      editCouponCode = coupon.code;
      fillCouponForm(coupon);
      couponStatus.textContent = `Editando cupon: ${coupon.code}`;
    }
  } catch (error) {
    couponStatus.textContent = error.message;
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  try {
    const payload = readForm();
    if (editId) {
      await request(API.update(editId), { method: "PUT", body: JSON.stringify(payload) });
      statusEl.textContent = `Juego actualizado: ${editId}`;
    } else {
      await request(API.add, { method: "POST", body: JSON.stringify(payload) });
      statusEl.textContent = `Juego agregado: ${payload.id}`;
    }

    resetForm();
    await loadMarketplace();
  } catch (error) {
    statusEl.textContent = error.message;
  }
});

refreshBtn.addEventListener("click", async () => {
  statusEl.textContent = "";
  await loadMarketplace();
});

gamesList.addEventListener("click", async (event) => {
  const deleteBtn = event.target.closest("button[data-delete]");
  const editBtn = event.target.closest("button[data-edit]");

  try {
    const data = await loadMarketplace();

    if (deleteBtn) {
      const id = deleteBtn.dataset.delete;
      await request(API.remove(id), { method: "DELETE" });
      statusEl.textContent = `Juego eliminado: ${id}`;
      await loadMarketplace();
      return;
    }

    if (editBtn) {
      const id = editBtn.dataset.edit;
      const game = (data.games || []).find((item) => item.id === id);
      if (!game) throw new Error("Juego no encontrado");
      editId = id;
      fillForm(game);
      statusEl.textContent = `Editando ${id}. Guarda para aplicar cambios.`;
    }
  } catch (error) {
    statusEl.textContent = error.message;
  }
});

(async function init() {
  try {
    if (!token()) {
      setAdminMode(false);
      updateOwnerAccessUI();
      return;
    }

    const session = await request(API.session);
    currentAdmin = session.admin.username;
    setAdminMode(true);
    updateOwnerAccessUI();
    await loadMarketplace();
    await loadUsers();
  } catch {
    setToken("");
    currentAdmin = "";
    setAdminMode(false);
    updateOwnerAccessUI();
  }
})();
