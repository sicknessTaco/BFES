const MEMBER_TOKEN_KEY = "bf_member_token";

const loginForm = document.getElementById("member-login-form");
const statusEl = document.getElementById("member-status");
const downloadsBtn = document.getElementById("member-load-downloads");
const downloadsEl = document.getElementById("member-downloads");

function memberToken() {
  return localStorage.getItem(MEMBER_TOKEN_KEY) || "";
}

async function authRequest(url, options = {}) {
  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
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
    downloadsBtn.classList.remove("hidden");
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
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Login fallido");

    localStorage.setItem(MEMBER_TOKEN_KEY, data.token);
    statusEl.textContent = `Membresia activa: ${data.user.membership.planId}`;
    downloadsBtn.classList.remove("hidden");
  } catch (error) {
    statusEl.textContent = error.message;
  }
});

downloadsBtn?.addEventListener("click", async () => {
  try {
    const data = await authRequest("/api/membership/downloads");
    downloadsEl.innerHTML = (data.downloads || []).map((item) => `<a href="${item.url}" class="block px-4 py-2 rounded-lg bg-red-700/70 hover:bg-red-600">Descargar ${item.name}</a>`).join("");
  } catch (error) {
    statusEl.textContent = error.message;
  }
});

loadMemberSession();
