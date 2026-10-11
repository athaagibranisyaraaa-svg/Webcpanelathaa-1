const express = require("express");
const { pool } = require("../db");
const { requireAuth } = require("../middleware/auth");
const router = express.Router();
router.use(requireAuth);
router.get("/", async (req,res) => {
  const result = await pool.query(
    `SELECT p.id,p.ptero_server_id,p.ptero_server_identifier,p.server_name,p.ram_mb,p.cpu_percent,p.disk_mb,p.created_at,
      r.request_code FROM panels p JOIN panel_requests r ON r.id=p.request_id
     WHERE p.user_id=$1 ORDER BY p.created_at DESC`,[req.user.id]);
  res.json({panels:result.rows,panelUrl:process.env.PANEL_URL});
});
module.exports = router;
