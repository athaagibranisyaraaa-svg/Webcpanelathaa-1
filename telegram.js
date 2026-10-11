const express = require("express");
const { pool } = require("../db");
const tg = require("../services/telegram");
const { processApproval } = require("../services/panel-creator");
const router = express.Router();

router.post("/webhook", async (req,res) => {
  if (req.get("X-Telegram-Bot-Api-Secret-Token") !== process.env.TELEGRAM_WEBHOOK_SECRET)
    return res.status(401).send("Unauthorized");
  res.sendStatus(200);
  const update = req.body;
  if (!update.callback_query) return;
  const cb = update.callback_query;
  const senderId = String(cb.from?.id || "");
  if (senderId !== String(process.env.TELEGRAM_OWNER_ID)) {
    await tg.answerCallback(cb.id,"Aksi hanya untuk owner.").catch(()=>{});
    return;
  }
  const match = /^(approve|reject):(\d+)$/.exec(cb.data || "");
  if (!match) return tg.answerCallback(cb.id,"Permintaan tidak valid.").catch(()=>{});
  const [, action, id] = match;
  try {
    if (action === "reject") {
      const result = await pool.query(
        `UPDATE panel_requests SET status='REJECTED',completed_at=NOW(),error_public='Permintaan ditolak oleh owner.'
         WHERE id=$1 AND status='PENDING_APPROVAL' RETURNING request_code,user_id`,[id]);
      if (!result.rowCount) return tg.answerCallback(cb.id,"Permintaan sudah diproses atau tidak ditemukan.").catch(()=>{});
      await pool.query("INSERT INTO audit_logs(action,request_id,details) VALUES('TELEGRAM_REJECT',$1,$2)",
        [id,JSON.stringify({telegram_owner_id:senderId})]);
      await tg.answerCallback(cb.id,"Permintaan ditolak.");
      await tg.telegram("editMessageReplyMarkup",{chat_id:cb.message.chat.id,message_id:cb.message.message_id,reply_markup:{inline_keyboard:[]}});
      await tg.sendMessage(process.env.TELEGRAM_OWNER_ID,`❌ Permintaan ${result.rows[0].request_code} ditolak.`);
    } else {
      await tg.answerCallback(cb.id,"Permintaan diterima. Proses dimulai.");
      await tg.telegram("editMessageReplyMarkup",{chat_id:cb.message.chat.id,message_id:cb.message.message_id,reply_markup:{inline_keyboard:[]}});
      await processApproval(id,senderId);
    }
  } catch (e) {
    await tg.sendMessage(process.env.TELEGRAM_OWNER_ID,"⚠️ Terjadi kesalahan saat memproses permintaan. Periksa log server yang terlindungi.").catch(()=>{});
  }
});
module.exports = router;
