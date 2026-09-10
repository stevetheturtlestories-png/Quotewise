const cfg=window.CHOICEGRADE_CONFIG||{};let sb=null;
async function init(){
 const el=document.getElementById("accountInfo");
 if(!cfg.supabaseUrl||!cfg.supabaseAnonKey||!window.supabase){el.innerHTML="<p>Supabase is not connected yet.</p>";return;}
 sb=window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseAnonKey);
 const {data:{session}}=await sb.auth.getSession();
 if(!session){location.href="auth.html?return=account.html";return;}
 const user=session.user;
 const {data}=await sb.from("entitlements").select("access_type,expires_at,status").eq("user_id",user.id).eq("status","active").order("created_at",{ascending:false}).limit(1).maybeSingle();
 let access="No active paid access";
 if(data?.access_type==="lifetime")access="Lifetime Homeowner Access";
 else if(data?.expires_at&&new Date(data.expires_at)>new Date())access=`30-Day Project Pass — active until ${new Date(data.expires_at).toLocaleDateString()}`;
 el.innerHTML=`<p><b>${user.email}</b></p><p>${access}</p>`;
}
async function signOut(){if(sb)await sb.auth.signOut();location.href="./";}
document.addEventListener("DOMContentLoaded",init);