window.CHOICEGRADE_CONFIG=window.CHOICEGRADE_CONFIG||{};
window.ChoiceGradeAccess=(()=>{
  let sb=null,user=null,entitlement=null;
  const cfg=window.CHOICEGRADE_CONFIG;

  async function init(){
    try{
      if(cfg.supabaseUrl&&cfg.supabaseAnonKey&&window.supabase){
        sb=window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseAnonKey);
        const {data}=await sb.auth.getSession();
        user=data?.session?.user||null;
        await refreshEntitlement();
        sb.auth.onAuthStateChange(async(_,session)=>{user=session?.user||null;await refreshEntitlement();updateAccountButton();});
      }
    }catch(e){console.warn("ChoiceGrade auth init:",e);}
    updateAccountButton();
  }

  async function refreshEntitlement(){
    entitlement=null;
    if(!sb||!user)return;
    try{
      const {data,error}=await sb.from("entitlements").select("access_type,expires_at,status").eq("user_id",user.id).eq("status","active").order("created_at",{ascending:false}).limit(1).maybeSingle();
      if(error)throw error;
      if(data && (data.access_type==="lifetime" || (data.expires_at && new Date(data.expires_at)>new Date()))) entitlement=data;
    }catch(e){console.warn("Entitlement check:",e);}
  }

  function hasPaidAccess(){return !!entitlement;}
  function updateAccountButton(){
    const b=document.getElementById("accountBtn");
    if(!b)return;
    b.textContent=user?(hasPaidAccess()?"Account ✓":"Account"):"Sign in";
  }

  function openPaywall(){
    document.getElementById("paywallOverlay")?.classList.remove("hidden");
    document.body.style.overflow="hidden";
  }
  function closePaywall(){
    document.getElementById("paywallOverlay")?.classList.add("hidden");
    document.body.style.overflow="";
  }

  function openAccount(){
    if(user) location.href="account.html";
    else location.href="auth.html?return=app.html";
  }

  async function beginCheckout(plan){
    localStorage.setItem("choicegrade-pending-plan",plan);
    if(!user){location.href=`auth.html?return=app.html&plan=${encodeURIComponent(plan)}`;return;}
    if(!cfg.checkoutEndpoint){
      alert("Payment setup is not connected yet. Your selected plan has been saved for the Stripe setup step.");
      return;
    }
    try{
      const session=(await sb.auth.getSession()).data.session;
      const r=await fetch(cfg.checkoutEndpoint,{method:"POST",headers:{"Content-Type":"application/json","Authorization":`Bearer ${session.access_token}`},body:JSON.stringify({plan})});
      const body=await r.json();
      if(!r.ok||!body.url)throw new Error(body.error||"Checkout unavailable");
      location.href=body.url;
    }catch(e){alert("Checkout could not be started. "+e.message);}
  }

  function gateResults(){
    if(hasPaidAccess())return true;
    setTimeout(openPaywall,80);
    return false;
  }

  document.addEventListener("DOMContentLoaded",init);
  return{init,hasPaidAccess,gateResults,openPaywall,closePaywall,beginCheckout,openAccount,refreshEntitlement};
})();