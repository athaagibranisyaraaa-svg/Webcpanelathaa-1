const { pool } = require("../db");
const ptero = require("./pterodactyl");
const tg = require("./telegram");

async function processApproval(requestId, actorTelegramId) {
  if (String(actorTelegramId) !== String(process.env.TELEGRAM_OWNER_ID))
    throw new Error("Tidak diizinkan.");
  const client = await pool.connect();
  let reqRow;
  try {
    await client.query("BEGIN");
    const changed = await client.query(
      `UPDATE panel_requests SET status='PROCESSING', approved_at=NOW()
       WHERE id=$1 AND status='PENDING_APPROVAL' RETURNING *`, [requestId]);
    if (!changed.rowCount) {
      await client.query("ROLLBACK");
      return { duplicate: true };
    }
    reqRow = changed.rows[0];
    await client.query("INSERT INTO audit_logs(actor_user_id, action, request_id, details) VALUES(NULL,'TELEGRAM_APPROVE',$1,$2)",
      [requestId, JSON.stringify({ telegram_owner_id: String(actorTelegramId) })]);
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK"); throw e;
  } finally { client.release(); }

  try {
    const existing = await ptero.findUserByEmail(reqRow.email);
    const existingUsername = await ptero.findUserByUsername(reqRow.requested_username);
    if (existing || existingUsername) throw new Error("Email atau username sudah terdaftar di Pterodactyl. Tidak ada perubahan yang dibuat.");

    const createdUser = await ptero.createUser({
      username: reqRow.requested_username, email: reqRow.email
    });
    const userAttrs = createdUser.attributes || createdUser;
    const serverAttrs = await ptero.createServer({
      name: `${reqRow.requested_username}-server`,
      userId: userAttrs.id, ramMb: reqRow.ram_mb,
      cpuPercent: reqRow.cpu_percent, diskMb: reqRow.disk_mb
    });

    const c = await pool.connect();
    try {
      await c.query("BEGIN");
      await c.query(
        `UPDATE panel_requests SET status='APPROVED', ptero_user_id=$2, ptero_server_id=$3,
         ptero_server_identifier=$4, completed_at=NOW(), error_public=NULL WHERE id=$1`,
        [requestId, userAttrs.id, serverAttrs.id, serverAttrs.identifier || null]);
      await c.query(
        `INSERT INTO panels(request_id,user_id,ptero_user_id,ptero_server_id,ptero_server_identifier,
         server_name,ram_mb,cpu_percent,disk_mb) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT(request_id) DO NOTHING`,
        [requestId, reqRow.user_id, userAttrs.id, serverAttrs.id, serverAttrs.identifier || null,
         serverAttrs.name || `${reqRow.requested_username}-server`, reqRow.ram_mb, reqRow.cpu_percent, reqRow.disk_mb]);
      await c.query("INSERT INTO audit_logs(action,request_id,details) VALUES('PANEL_CREATED',$1,$2)",
        [requestId, JSON.stringify({ ptero_user_id: userAttrs.id, ptero_server_id: serverAttrs.id })]);
      await c.query("COMMIT");
    } catch (e) { await c.query("ROLLBACK"); throw e; } finally { c.release(); }

    await tg.sendMessage(process.env.TELEGRAM_OWNER_ID,
      `✅ PANEL BERHASIL DIBUAT\nID: ${reqRow.request_code}\nUsername: ${reqRow.requested_username}\nServer ID: ${serverAttrs.id}`);
    return { success: true };
  } catch (err) {
    const safeMessage = "Pembuatan gagal. Owner perlu memeriksa konfigurasi API, resource, egg, node, dan allocation.";
    await pool.query("UPDATE panel_requests SET status='FAILED', error_public=$2, completed_at=NOW() WHERE id=$1",
      [requestId, safeMessage]);
    await pool.query("INSERT INTO audit_logs(action,request_id,details) VALUES('PANEL_CREATE_FAILED',$1,$2)",
      [requestId, JSON.stringify({ internal_error: String(err.message).slice(0, 300) })]);
    await tg.sendMessage(process.env.TELEGRAM_OWNER_ID,
      `⚠️ CREATE PANEL GAGAL\nID: ${reqRow.request_code}\nAlasan aman: ${safeMessage}`).catch(() => {});
    throw err;
  }
}
module.exports = { processApproval };
