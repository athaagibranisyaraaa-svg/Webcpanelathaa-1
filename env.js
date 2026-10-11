require("dotenv").config();

const required = ["DATABASE_URL", "SESSION_SECRET", "PANEL_URL", "PLTA",
  "TELEGRAM_BOT_TOKEN", "TELEGRAM_OWNER_ID", "TELEGRAM_WEBHOOK_SECRET"];

function validateEnv() {
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length) throw new Error(`Environment belum lengkap: ${missing.join(", ")}`);
  if (process.env.NODE_ENV === "production" && process.env.SESSION_SECRET.length < 32)
    throw new Error("SESSION_SECRET produksi harus minimal 32 karakter.");
  const panel = new URL(process.env.PANEL_URL);
  if (process.env.NODE_ENV === "production" && panel.protocol !== "https:")
    throw new Error("PANEL_URL harus menggunakan HTTPS di produksi.");
}
function csv(name, fallback) {
  return (process.env[name] || fallback).split(",").map(v => v.trim()).filter(Boolean);
}
module.exports = { validateEnv, csv };
