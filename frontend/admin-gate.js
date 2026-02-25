const phraseInput = document.getElementById("admin-phrase");
const phraseBtn = document.getElementById("admin-phrase-btn");
const phraseStatus = document.getElementById("admin-phrase-status");
const loginBox = document.getElementById("admin-login");
const loginBtn = document.getElementById("admin-login-btn");

async function loginAdmin(username, password) {
  const res = await fetch("/api/admin/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "No se pudo iniciar sesion");
  localStorage.setItem("bf_admin_token", data.token);
}

phraseBtn?.addEventListener("click", () => {
  const value = String(phraseInput?.value || "").trim().toLowerCase();
  if (value !== "forgeplay") {
    phraseStatus.textContent = "Combinacion invalida.";
    loginBox?.classList.add("hidden");
    return;
  }

  phraseStatus.textContent = "Combinacion valida. Ingresa credenciales.";
  loginBox?.classList.remove("hidden");
});

loginBtn?.addEventListener("click", async () => {
  try {
    const username = document.getElementById("admin-user")?.value?.trim();
    const password = document.getElementById("admin-pass")?.value || "";
    await loginAdmin(username, password);
    window.location.href = "./admin.html";
  } catch (error) {
    phraseStatus.textContent = error.message;
  }
});
