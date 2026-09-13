window.CHOICEGRADE_CONFIG = window.CHOICEGRADE_CONFIG || {};

window.ChoiceGradeAccess = (() => {
  let sb = null;
  let user = null;
  let entitlement = null;

  const cfg = window.CHOICEGRADE_CONFIG;

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function showCheckoutStatus(message, type = "info") {
    let box = document.getElementById("checkoutStatus");

    if (!box) {
      box = document.createElement("div");
      box.id = "checkoutStatus";

      box.style.position = "fixed";
      box.style.left = "50%";
      box.style.top = "24px";
      box.style.transform = "translateX(-50%)";
      box.style.zIndex = "99999";
      box.style.maxWidth = "90%";
      box.style.width = "520px";
      box.style.padding = "16px 18px";
      box.style.borderRadius = "12px";
      box.style.boxShadow = "0 10px 30px rgba(0,0,0,.25)";
      box.style.fontSize = "16px";
      box.style.fontWeight = "600";
      box.style.textAlign = "center";

      document.body.appendChild(box);
    }

    if (type === "success") {
      box.style.background = "#e9f7ef";
      box.style.color = "#14532d";
      box.style.border = "1px solid #86c89a";
    } else if (type === "error") {
      box.style.background = "#fff0f0";
      box.style.color = "#7f1d1d";
      box.style.border = "1px solid #e5a1a1";
    } else {
      box.style.background = "#ffffff";
      box.style.color = "#11263a";
      box.style.border = "1px solid rgba(17,38,58,.15)";
    }

    box.textContent = message;
    box.style.display = "block";
  }

  function hideCheckoutStatus(delay = 0) {
    const box = document.getElementById("checkoutStatus");
    if (!box) return;

    if (delay > 0) {
      setTimeout(() => {
        box.style.display = "none";
      }, delay);
    } else {
      box.style.display = "none";
    }
  }

  async function init() {
    try {
      if (
        cfg.supabaseUrl &&
        cfg.supabaseAnonKey &&
        window.supabase
      ) {
        sb = window.supabase.createClient(
          cfg.supabaseUrl,
          cfg.supabaseAnonKey
        );

        const { data } = await sb.auth.getSession();

        user = data?.session?.user || null;

        await refreshEntitlement();

        sb.auth.onAuthStateChange(
          async (_, session) => {
            user = session?.user || null;

            await refreshEntitlement();

            updateAccountButton();
          }
        );
      }
    } catch (e) {
      console.warn("ChoiceGrade auth init:", e);
    }

    updateAccountButton();

    await handleCheckoutReturn();
  }

  async function refreshEntitlement() {
    entitlement = null;

    if (!sb || !user) return;

    try {
      const { data, error } = await sb
        .from("entitlements")
        .select("access_type,expires_at,status")
        .eq("user_id", user.id)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (
        data &&
        (
          data.access_type === "lifetime" ||
          (
            data.expires_at &&
            new Date(data.expires_at) > new Date()
          )
        )
      ) {
        entitlement = data;
      }
    } catch (e) {
      console.warn("Entitlement check:", e);
    }
  }

  function hasPaidAccess() {
    return !!entitlement;
  }

  function updateAccountButton() {
    const b = document.getElementById("accountBtn");

    if (!b) return;

    b.textContent = user
      ? (
          hasPaidAccess()
            ? "Account ✓"
            : "Account"
        )
      : "Sign in";
  }

  function openPaywall() {
    document
      .getElementById("paywallOverlay")
      ?.classList.remove("hidden");

    document.body.style.overflow = "hidden";
  }

  function closePaywall() {
    document
      .getElementById("paywallOverlay")
      ?.classList.add("hidden");

    document.body.style.overflow = "";
  }

  function openAccount() {
    if (user) {
      location.href = "account.html";
    } else {
      location.href = "auth.html?return=app.html";
    }
  }

  async function beginCheckout(plan) {
    localStorage.setItem(
      "choicegrade-pending-plan",
      plan
    );

    if (!user) {
      location.href =
        `auth.html?return=app.html&plan=${encodeURIComponent(plan)}`;

      return;
    }

    if (!cfg.checkoutEndpoint) {
      alert(
        "Payment setup is not connected yet. Your selected plan has been saved for the Stripe setup step."
      );

      return;
    }

    try {
      const session =
        (await sb.auth.getSession())
          .data
          .session;

      const r = await fetch(
        cfg.checkoutEndpoint,
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
            "Authorization":
              `Bearer ${session.access_token}`,
          },

          body: JSON.stringify({
            plan,
          }),
        }
      );

      const body = await r.json();

      if (!r.ok || !body.url) {
        throw new Error(
          body.error ||
          "Checkout unavailable"
        );
      }

      location.href = body.url;

    } catch (e) {
      alert(
        "Checkout could not be started. " +
        e.message
      );
    }
  }

  async function handleCheckoutReturn() {
    const params =
      new URLSearchParams(
        window.location.search
      );

    const checkout =
      params.get("checkout");

    if (checkout === "cancelled") {
      showCheckoutStatus(
        "Payment was cancelled. No charge was made.",
        "info"
      );

      hideCheckoutStatus(4000);

      cleanCheckoutUrl();

      return;
    }

    if (checkout !== "success") {
      return;
    }

    showCheckoutStatus(
      "Payment successful — unlocking your ChoiceGrade results…",
      "info"
    );

    closePaywall();

    const maxAttempts = 12;

    for (
      let attempt = 1;
      attempt <= maxAttempts;
      attempt++
    ) {
      await refreshEntitlement();

      if (hasPaidAccess()) {
        closePaywall();

        updateAccountButton();

        showCheckoutStatus(
          "Payment successful — your ChoiceGrade results are now unlocked.",
          "success"
        );

        localStorage.removeItem(
          "choicegrade-pending-plan"
        );

        cleanCheckoutUrl();

        hideCheckoutStatus(5000);

        return;
      }

      await sleep(1000);
    }

    showCheckoutStatus(
      "Your payment was successful. ChoiceGrade is still finishing your access setup. Please wait a moment and refresh this page.",
      "info"
    );

    cleanCheckoutUrl();
  }

  function cleanCheckoutUrl() {
    const url =
      new URL(window.location.href);

    url.searchParams.delete("checkout");
    url.searchParams.delete("session_id");

    window.history.replaceState(
      {},
      document.title,
      url.pathname +
      url.search +
      url.hash
    );
  }

  function gateResults() {
    if (hasPaidAccess()) {
      return true;
    }

    setTimeout(
      openPaywall,
      80
    );

    return false;
  }

  document.addEventListener(
    "DOMContentLoaded",
    init
  );

  return {
    init,
    hasPaidAccess,
    gateResults,
    openPaywall,
    closePaywall,
    beginCheckout,
    openAccount,
    refreshEntitlement,
  };
})();
