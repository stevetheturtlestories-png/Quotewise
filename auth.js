const cfg=window.CHOICEGRADE_CONFIG||{};
const msg=t=>document.getElementById("authMessage").textContent=t;
let sb=null;
if(cfg.supabaseUrl&&cfg.supabaseAnonKey&&window.supabase)sb=window.supabase.createClient(cfg.supabaseUrl,cfg.supabaseAnonKey);
const params=new URLSearchParams(location.search);
const returnTo=params.get("return")||"app.html";
const plan=params.get("plan");
if(plan)localStorage.setItem("choicegrade-pending-plan",plan);

async function signIn(){
 if(!sb){msg("Supabase is not connected yet. Add your project URL and anon key to config.js.");return;}
 const email=document.getElementById("email").value.trim(),password=document.getElementById("password").value;
 const {error}=await sb.auth.signInWithPassword({email,password});if(error){msg(error.message);return;}location.href=returnTo;
}
async function signUp(){
 if(!sb){msg("Supabase is not connected yet. Add your project URL and anon key to config.js.");return;}
 const email=document.getElementById("email").value.trim(),password=document.getElementById("password").value;
 const {data,error}=await sb.auth.signUp({email,password,options:{emailRedirectTo:new URL(returnTo,location.href).href}});
 if(error){msg(error.message);return;}
 msg(data.session?"Account created. Redirecting…":"Check your email to confirm your account, then return to ChoiceGrade.");
 if(data.session)setTimeout(()=>location.href=returnTo,500);
}
async function sendMagicLink(){
 if(!sb){msg("Supabase is not connected yet. Add your project URL and anon key to config.js.");return;}
 const email=document.getElementById("email").value.trim();if(!email){msg("Enter your email first.");return;}
 const {error}=await sb.auth.signInWithOtp({email,options:{emailRedirectTo:new URL(returnTo,location.href).href}});
 msg(error?error.message:"Check your email for your ChoiceGrade sign-in link.");
}