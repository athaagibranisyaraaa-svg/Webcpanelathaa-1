const base = () => (process.env.PANEL_URL || "").replace(/\/+$/, "");

async function api(path, method = "GET", body) {
  const response = await fetch(`${base()}/api/application${path}`, {
    method,
    headers: {
      "Authorization": `Bearer ${process.env.PLTA}`,
      "Accept": "Application/vnd.pterodactyl.v1+json",
      "Content-Type": "application/json"
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20000)
  });
  const text = await response.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch { data = {}; }
  if (!response.ok) {
    const err = new Error(`Pterodactyl API returned HTTP ${response.status}`);
    err.status = response.status;
    // Do not include API response body in user-facing errors; it may contain sensitive data.
    throw err;
  }
  return data;
}

async function findUserByEmail(email) {
  const q = encodeURIComponent(email);
  const data = await api(`/users?filter[email]=${q}`);
  return (data.data || []).map(x => x.attributes).find(x => x.email.toLowerCase() === email.toLowerCase()) || null;
}

async function findUserByUsername(username) {
  const q = encodeURIComponent(username);
  const data = await api(`/users?filter[username]=${q}`);
  return (data.data || []).map(x => x.attributes).find(x => x.username.toLowerCase() === username.toLowerCase()) || null;
}

async function createUser({ username, email }) {
  // Omitting password lets the Pterodactyl installation apply its account onboarding/reset flow.
  // Configure mail delivery in Pterodactyl so the user can set a password securely.
  return api("/users", "POST", { username, email, first_name: username, last_name: "Panel" });
}

async function createServer({ name, userId, ramMb, cpuPercent, diskMb }) {
  const locationId = Number(process.env.PTERO_LOCATION_ID);
  const eggId = Number(process.env.PTERO_EGG_ID);
  const allowedLocations = (process.env.PTERO_ALLOWED_LOCATIONS || String(process.env.PTERO_LOCATION_ID || "")).split(",").map(Number).filter(Boolean);
  const allowedEggs = (process.env.PTERO_ALLOWED_EGGS || "").split(",").map(Number).filter(Boolean);
  if (!Number.isInteger(locationId) || !Number.isInteger(eggId) ||
      !allowedEggs.includes(eggId) || !allowedLocations.includes(locationId)) {
    throw new Error("Konfigurasi lokasi/egg/node belum disetel atau tidak diizinkan.");
  }

  // Ask Pterodactyl to choose an available allocation from the configured location.
  // If a fixed node/allocation policy is required, configure it in the panel and validate it here.
  const egg = await api(`/nests/${Number(process.env.PTERO_NEST_ID || 1)}/eggs/${eggId}?include=variables`);
  const eggAttrs = egg.attributes || {};
  const env = {};
  for (const variable of (eggAttrs.relationships?.variables?.data || [])) {
    const a = variable.attributes;
    env[a.env_variable] = a.default_value || "";
  }

  const body = {
    name, user: Number(userId), egg: eggId,
    docker_image: process.env.PTERO_DOCKER_IMAGE || eggAttrs.docker_image,
    startup: process.env.PTERO_STARTUP || eggAttrs.startup,
    environment: env,
    limits: { memory: ramMb, swap: 0, disk: diskMb, io: 500, cpu: cpuPercent },
    feature_limits: { databases: 0, backups: 1, allocations: 1 },
    deploy: { locations: [locationId], dedicated_ip: false, port_range: [] },
    start_on_completion: false
  };
  const result = await api("/servers", "POST", body);
  return result.attributes;
}

module.exports = { api, findUserByEmail, findUserByUsername, createUser, createServer };
