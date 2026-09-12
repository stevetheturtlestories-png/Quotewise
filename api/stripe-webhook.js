import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

async function getRawBody(req) {
  const chunks = [];

  for await (const chunk of req) {
    chunks.push(
      Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    );
  }

  return Buffer.concat(chunks);
}

async function grantEntitlement(session) {
  if (session.payment_status !== "paid") {
    return;
  }

  const userId = session.metadata?.user_id;
  const plan = session.metadata?.plan;

  if (!userId) {
    throw new Error("Stripe session is missing user_id metadata");
  }

  if (plan !== "project_30" && plan !== "lifetime") {
    throw new Error("Stripe session contains an invalid plan");
  }

  const now = new Date();

  let expiresAt = null;

  if (plan === "project_30") {
    const expiry = new Date(now);
    expiry.setDate(expiry.getDate() + 30);
    expiresAt = expiry.toISOString();
  }

  const stripeCustomerId =
    typeof session.customer === "string"
      ? session.customer
      : session.customer?.id || null;

  const { error } = await supabaseAdmin
    .from("entitlements")
    .insert({
      user_id: userId,
      access_type: plan,
      status: "active",
      starts_at: now.toISOString(),
      expires_at: expiresAt,
      stripe_customer_id: stripeCustomerId,
      stripe_checkout_session_id: session.id,
    });

  if (error) {
    if (error.code === "23505") {
      return;
    }

    throw error;
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");

    return res.status(405).json({
      error: "Method not allowed",
    });
  }

  try {
    if (
      !process.env.STRIPE_SECRET_KEY ||
      !process.env.STRIPE_WEBHOOK_SECRET ||
      !process.env.SUPABASE_URL ||
      !process.env.SUPABASE_SERVICE_ROLE_KEY
    ) {
      return res.status(500).json({
        error: "Webhook configuration is incomplete",
      });
    }

    const signature = req.headers["stripe-signature"];

    if (!signature) {
      return res.status(400).json({
        error: "Missing Stripe signature",
      });
    }

    const rawBody = await getRawBody(req);

    const event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );

    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded":
        await grantEntitlement(event.data.object);
        break;

      default:
        break;
    }

    return res.status(200).json({
      received: true,
    });

  } catch (error) {
    console.error(
      "ChoiceGrade Stripe webhook error:",
      error
    );

    return res.status(400).json({
      error: "Webhook processing failed",
    });
  }
}
