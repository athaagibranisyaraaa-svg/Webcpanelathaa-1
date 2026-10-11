const form=document.getElementById("createForm");
function fill(id, values, suffix){const el=document.getElementById(id);el.innerHTML=values.map(v=>`<option value="${v}">${v===-1?"UNLIMITED":v+" "+suffix}</option>`).join("");}
(async()=>{
 try{const me=await fetch("/api/auth/me");if(!me.ok){location.href="/login.html";return;}
 const r=await fetch("/api/requests/options");const o=await r.json();fill("ram",o.ram,"GB");fill("cpu",o.cpu,"% CPU");fill("disk",o.disk,"GB");
 }catch(e){show("Gagal memuat pilihan resource.",true);}
})();
function show(text,error=false){const m=document.getElementById("message");m.className="message "+(error?"error":"success");m.textContent=text;}
form.addEventListener("submit",async e=>{
 e.preventDefault();const btn=document.getElementById("submitBtn"),progress=document.getElementById("progress");
 btn.disabled=true;btn.textContent="Mengirim…";progress.classList.remove("hidden");show("");
 const d=Object.fromEntries(new FormData(form).entries());d.ramGb=Number(d.ramGb);d.cpu=Number(d.cpu);d.diskGb=Number(d.diskGb);
 try{const r=await fetch("/api/requests",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(d)});const data=await r.json();if(!r.ok)throw new Error(data.error||"Permintaan gagal.");
 show(`${data.message}\nID: ${data.request.request_code}`);form.reset();
 }catch(err){show(err.message,true);}finally{btn.disabled=false;btn.textContent="CREATE PANEL →";progress.classList.add("hidden");}
});
