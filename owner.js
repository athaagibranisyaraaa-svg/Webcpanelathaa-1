const express = require("express");
const { pool } = require("../db");
const { requireAuth, requireOwner } = require("../middleware/auth");
const router = express.Router();
router.use(requireAuth,requireOwner);
router.get("/requests", async (req,res) => {
  const status = String(req.query.status || "");
  const q = String(req.query.q || "").slice(0,100);
  const values = []; let where = [];
  if (status) { values.push(status); where.push(`status=$${values.length}`); }
  if (q) { values.push(`%${q}%`); where.push(`(request_code ILIKE $${values.length} OR requested_username ILIKE $${values.length} OR email ILIKE $${values.length})`); }
  const result = await pool.query(
    `SELECT id,request_code,user_id,email,requested_username,ram_mb,cpu_percent,disk_mb,status,error_public,created_at,approved_at,completed_at
     FROM panel_requests ${where.length ? "WHERE "+where.join(" AND ") : ""} ORDER BY created_at DESC LIMIT 500`,values);
  res.json({requests:result.rows});
});
router.get("/stats", async (req,res) => {
  const result = await pool.query(`SELECT status,COUNT(*)::int AS count FROM panel_requests GROUP BY status`);
  const today = await pool.query("SELECT COUNT(*)::int AS count FROM panel_requests WHERE created_at >= CURRENT_DATE");
  res.json({byStatus:result.rows,today:today.rows[0].count});
});
router.get("/audit", async (req,res) => {
  const result = await pool.query("SELECT id,actor_user_id,action,request_id,details,created_at FROM audit_logs ORDER BY created_at DESC LIMIT 200");
  res.json({logs:result.rows});
});
router.post("/requests/:id/cancel", async (req,res) => {
  const result = await pool.query(
    `UPDATE panel_requests SET status='REJECTED',completed_at=NOW(),error_public='Dibatalkan oleh owner.'
     WHERE id=$1 AND status='PENDING_APPROVAL' RETURNING id,request_code,user_id`,[req.params.id]);
  if (!result.rowCount) return res.status(409).json({error:"Permintaan tidak menunggu persetujuan atau tidak ditemukan."});
  await pool.query("INSERT INTO audit_logs(actor_user_id,action,request_id,details) VALUES($1,'OWNER_CANCEL',$2,'{}')",[req.user.id,req.params.id]);
  res.json({ok:true});
});
module.exports = router;
