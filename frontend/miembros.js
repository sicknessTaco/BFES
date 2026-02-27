const MEMBER_TOKEN_KEY = "bf_member_token";
const DEVICE_KEY = "bf_device_id";

const metaEl = document.getElementById("member-meta");
const statusEl = document.getElementById("member-status");
const downloadsEl = document.getElementById("member-downloads");
const logoutBtn = document.getElementById("member-logout");

function clientDeviceId() {
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = (crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`).replace(/\s+/g, "");
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

function memberToken() {
  return localStorage.getItem(MEMBER_TOKEN_KEY) || "";
}

function authHeaders() {
  return {
    "Content-Type": "application/json",
    "x-client-device-id": clientDeviceId(),
    Authorization: `Bearer ${memberToken()}`
  };
}

async function authGet(url) {
  const res = await fetch(url, { headers: authHeaders() });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

function renderDownloads(downloads) {
  if (!Array.isArray(downloads) || !downloads.length) {
    downloadsEl.innerHTML = '<p class="text-zinc-500">No hay descargas habilitadas para este rango.</p>';
    return;
  }

  downloadsEl.innerHTML = downloads.map((item) => `
    <article class="glass rounded-2xl p-4 border border-white/10">
      <p class="font-display text-xl">${item.name}</p>
      <p class="text-zinc-500 text-xs mt-1">${item.id}</p>
      <a href="${item.url}" class="mt-3 inline-block px-4 py-2 rounded-lg bg-red-700 hover:bg-red-600">Descargar</a>
    </article>
  `).join("");
}

async function init() {
  if (!memberToken()) {
    window.location.href = "./membresia.html";
    return;
  }

  try {
    const [me, downloads] = await Promise.all([
      authGet("/api/membership/me"),
      authGet("/api/membership/downloads")
    ]);

    const planId = me.user?.membership?.planId || "unknown";
    const access = Array.isArray(downloads.access) ? downloads.access.join(", ") : "all";
    metaEl.textContent = `Cuenta: ${me.user.email} | Plan: ${planId}`;
    statusEl.textContent = `Acceso del plan: ${access}`;
    renderDownloads(downloads.downloads || []);
  } catch (error) {
    localStorage.removeItem(MEMBER_TOKEN_KEY);
    metaEl.textContent = "Sesion invalida para este dispositivo.";
    statusEl.textContent = error.message;
    downloadsEl.innerHTML = '<p class="text-zinc-500">Vuelve a iniciar sesion desde esta PC.</p>';
  }
}

logoutBtn?.addEventListener("click", () => {
  localStorage.removeItem(MEMBER_TOKEN_KEY);
  window.location.href = "./membresia.html";
});

init();
