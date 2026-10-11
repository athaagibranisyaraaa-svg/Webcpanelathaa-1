(async()=>{
 const link=document.getElementById("authLink");
 try{const r=await fetch("/api/auth/me");if(r.ok){const d=await r.json();link.textContent=d.user.role==="owner"?"Owner":"Dashboard";link.href=d.user.role==="owner"?"/owner.html":"/dashboard.html";}}catch{}
})();
