const MEMBER_TOKEN_KEY = "bf_member_token";
const DEVICE_KEY = "bf_device_id";

const loginForm = document.getElementById("member-login-form");
const statusEl = document.getElementById("member-status");
const portalBtn = document.getElementById("member-open-portal");

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

async function authRequest(url, options = {}) {
  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      "x-client-device-id": clientDeviceId(),
      Authorization: `Bearer ${memberToken()}`
    },
    ...options
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

async function loadMemberSession() {
  if (!memberToken()) return;
  try {
    const data = await authRequest("/api/membership/me");
    statusEl.textContent = `Membresia activa: ${data.user.membership.planId}`;
    portalBtn?.classList.remove("hidden");
  } catch {
    localStorage.removeItem(MEMBER_TOKEN_KEY);
  }
}

loginForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  try {
    const email = document.getElementById("member-email").value.trim();
    const password = document.getElementById("member-password").value;
    const res = await fetch("/api/membership/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-client-device-id": clientDeviceId()
      },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Login fallido");

    localStorage.setItem(MEMBER_TOKEN_KEY, data.token);
    statusEl.textContent = `Membresia activa: ${data.user.membership.planId}`;
    portalBtn?.classList.remove("hidden");
  } catch (error) {
    statusEl.textContent = error.message;
  }
});

portalBtn?.addEventListener("click", () => {
  window.location.href = "./miembros.html";
});

loadMemberSession();
