const phraseStatus = document.getElementById("admin-phrase-status");
const loginBtn = document.getElementById("admin-login-btn");
const vignette = document.getElementById("admin-vignette");
const panel = document.getElementById("admin-login-panel");
const closeBtn = document.getElementById("admin-panel-close");
const DEVICE_KEY = "bf_device_id";

function clientDeviceId() {
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = (crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`).replace(/\s+/g, "");
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

async function loginAdmin(username, password) {
  const res = await fetch("/api/admin/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-client-device-id": clientDeviceId()
    },
    body: JSON.stringify({ username, password })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "No se pudo iniciar sesion");
  localStorage.setItem("bf_admin_token", data.token);
}

vignette?.addEventListener("click", () => {
  panel?.classList.remove("hidden");
  phraseStatus.textContent = "";
});

closeBtn?.addEventListener("click", () => {
  panel?.classList.add("hidden");
});

loginBtn?.addEventListener("click", async () => {
  try {
    const username = document.getElementById("admin-user")?.value?.trim();
    const password = document.getElementById("admin-pass")?.value || "";
    await loginAdmin(username, password);
    panel?.classList.add("hidden");
    window.location.href = "./admin.html";
  } catch (error) {
    phraseStatus.textContent = error.message;
  }
});
