const form = document.getElementById("contact-form");
const statusEl = document.getElementById("form-status");
const sendBtn = document.getElementById("send-btn");

let config = null;

function getErrorMessage(error) {
  if (!error) return "Error desconocido al enviar el mensaje.";
  if (typeof error === "string") return error;
  if (error instanceof Error && error.message) return error.message;
  if (typeof error.text === "string" && error.text) return error.text;
  if (typeof error.status === "number" && error.status) {
    return `Error de EmailJS (status ${error.status}). Verifica service/template/public key.`;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return "Error inesperado al enviar el mensaje.";
  }
}

async function loadConfig() {
  const res = await fetch("/api/contact/config");
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || "No se pudo cargar configuracion de contacto");
  }

  if (!data.publicKey || !data.serviceId || !data.templateId) {
    throw new Error("Falta configurar EmailJS en backend/.env");
  }

  config = data;

  if (!window.emailjs) {
    throw new Error("EmailJS no cargo en el navegador. Revisa tu conexion o el script CDN.");
  }

  emailjs.init({ publicKey: config.publicKey });
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  try {
    if (!config) {
      await loadConfig();
    }

    sendBtn.disabled = true;
    statusEl.textContent = "Enviando mensaje...";

    const payload = {
      name: document.getElementById("name").value.trim(),
      email: document.getElementById("email").value.trim(),
      time: new Date().toLocaleString("es-MX"),
      message: document.getElementById("message").value.trim()
    };

    await emailjs.send(config.serviceId, config.templateId, payload);
    form.reset();
    statusEl.textContent = "Mensaje enviado correctamente.";
  } catch (error) {
    statusEl.textContent = `Error: ${getErrorMessage(error)}`;
  } finally {
    sendBtn.disabled = false;
  }
});

loadConfig().catch((error) => {
  statusEl.textContent = `Configuracion pendiente: ${getErrorMessage(error)}`;
});
