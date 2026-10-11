const express = require("express");
const crypto = require("crypto");
const { pool } = require("../db");
const { requireAuth } = require("../middleware/auth");
const tg = require("../services/telegram");
const { csv } = require("../config/env");
const router = express.Router();
router.use(requireAuth);

function options() {
  const ram = csv("RAM_OPTIONS_GB","1,2,3,4,5,6,8").map(Number).filter(Number.isFinite);
  if (String(process.env.ALLOW_UNLIMITED).toLowerCase() === "true") ram.push(-1);
  return { ram, cpu: csv("CPU_OPTIONS","50,100,150,200,300,400").map(Number),
    disk: csv("DISK_OPTIONS_GB","2,5,10,15,20").map(Number) };
}
router.get("/options", (req,res) => res.json(options()));
router.post("/", async (req,res) => {
  const username = String(req.body.username || "").trim().toLowerCase();
  const email = String(req.body.email || "").trim().toLowerCase();
  const ramGb = Number(req.body.ramGb), cpu = Number(req.body.cpu), diskGb = Number(req.body.diskGb);
  const opt = options();
  if (!/^[a-z0-9_]{3,20}$/.test(username)) return res.status(400).json({error:"Username harus 3–20 karakter: huruf kecil, angka, underscore."});
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({error:"Format email tidak valid."});
  if (!opt.ram.includes(ramGb) || !opt.cpu.includes(cpu) || !opt.disk.includes(diskGb))
    return res.status(400).json({error:"Pilihan resource tidak diizinkan."});
  const ramMb = ramGb === -1 ? Number(process.env.MAX_RAM_MB || 8192) : ramGb * 1024;
  const diskMb = diskGb * 1024;
  if (ramMb > Number(process.env.MAX_RAM_MB || 8192) || cpu > Number(process.env.MAX_CPU_PERCENT || 400) ||
      diskMb > Number(process.env.MAX_DISK_MB || 20480))
    return res.status(400).json({error:"Resource melebihi batas owner."});
  const count = await pool.query(
    "SELECT COUNT(*)::int AS n FROM panel_requests WHERE user_id=$1 AND created_at > NOW()-INTERVAL '24 hours'",[req.user.id]);
  if (count.rows[0].n >= 3) return res.status(429).json({error:"Maksimal 3 permintaan dalam 24 jam."});
  const code = "REQ-" + crypto.randomBytes(4).toString("hex").toUpperCase();
  const saved = await pool.query(
    `INSERT INTO panel_requests(request_code,user_id,email,requested_username,ram_mb,cpu_percent,disk_mb)
     VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id,request_code,email,requested_username,ram_mb,cpu_percent,disk_mb,status,created_at`,
    [code,req.user.id,email,username,ramMb,cpu,diskMb]);
  try {
    const message = await tg.sendApprovalRequest(saved.rows[0]);
    await pool.query("UPDATE panel_requests SET telegram_message_id=$2 WHERE id=$1",[saved.rows[0].id,message.message_id]);
  } catch (e) {
    await pool.query("UPDATE panel_requests SET status='FAILED',error_public=$2,completed_at=NOW() WHERE id=$1",
      [saved.rows[0].id,"Notifikasi Telegram gagal dikirim. Owner perlu memeriksa konfigurasi bot."]);
    return res.status(502).json({error:"Permintaan tersimpan tetapi notifikasi owner gagal dikirim. Hubungi owner; jangan kirim berulang kali.",requestCode:code});
  }
  res.status(201).json({request:saved.rows[0],message:"Permintaan panel berhasil dikirim. Silakan tunggu persetujuan owner melalui Telegram."});
});
router.get("/", async (req,res) => {
  const result = await pool.query(
    `SELECT id,request_code,requested_username,ram_mb,cpu_percent,disk_mb,status,error_public,created_at,approved_at,completed_at,ptero_server_id
     FROM panel_requests WHERE user_id=$1 ORDER BY created_at DESC LIMIT 100`,[req.user.id]);
  res.json({requests:result.rows});
});
router.get("/:id", async (req,res) => {
  const result = await pool.query(
    `SELECT id,request_code,requested_username,ram_mb,cpu_percent,disk_mb,status,error_public,created_at,approved_at,completed_at,ptero_server_id
     FROM panel_requests WHERE id=$1 AND user_id=$2`,[req.params.id,req.user.id]);
  if (!result.rowCount) return res.status(404).json({error:"Permintaan tidak ditemukan."});
  res.json({request:result.rows[0]});
});
module.exports = router;
