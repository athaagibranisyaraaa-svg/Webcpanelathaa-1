async function submitAuth(formId, endpoint) {
 const form=document.getElementById(formId); if(!form)return;
 form.addEventListener("submit",async e=>{
  e.preventDefault(); const message=document.getElementById("message"); message.className="message"; message.textContent="Memproses…";
  const body=Object.fromEntries(new FormData(form).entries());
  try{const r=await fetch("/api/auth/"+endpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
   const d=await r.json(); if(!r.ok)throw new Error(d.error||"Gagal.");
   message.className="message success";message.textContent="Berhasil. Mengalihkan…";
   location.href=d.user.role==="owner"?"/owner.html":"/dashboard.html";
  }catch(err){message.className="message error";message.textContent=err.message;}
 });
}
submitAuth("loginForm","login");submitAuth("registerForm","register");
