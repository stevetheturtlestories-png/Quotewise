import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const PRICE_IDS = {
  project_30: "price_1UEI7A0UVkfOUpU40MBdfNnU",
  lifetime: "price_1UEIDr0UVkfOUpU4hMhYxsWN",
};

const APP_URL = (
  process.env.CHOICEGRADE_APP_URL ||
  "https://choicegradeapp.com"
).replace(/\/$/, "");

export default async function handler(req, res) {
  res.setHeader(
    "Access-Control-Allow-Origin",
    "https://choicegradeapp.com"
  );

  res.setHeader(
    "Access-Control-Allow-Methods",
    "POST, OPTIONS"
  );

  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization"
  );

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({
      error: "Method not allowed",
    });
  }

  try {
    if (
      !process.env.STRIPE_SECRET_KEY ||
      !process.env.SUPABASE_URL ||
      !process.env.SUPABASE_ANON_KEY
    ) {
      return res.status(500).json({
        error: "Server payment configuration is incomplete",
      });
    }

    const authHeader = req.headers.authorization || "";

    const accessToken = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : null;

    if (!accessToken) {
      return res.status(401).json({
        error: "Sign in before starting checkout",
      });
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );

    const { data, error: userError } =
      await supabase.auth.getUser(accessToken);

    const user = data?.user;

    if (userError || !user) {
      return res.status(401).json({
        error: "Your sign-in session is invalid or expired",
      });
    }

    const { plan } = req.body || {};
    const priceId = PRICE_IDS[plan];

    if (!priceId) {
      return res.status(400).json({
        error: "Invalid ChoiceGrade plan",
      });
    }

    const session =
      await stripe.checkout.sessions.create({
        mode: "payment",

        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],

        client_reference_id: user.id,

        customer_email:
          user.email || undefined,

        metadata: {
          user_id: user.id,
          plan,
        },

        payment_intent_data: {
          metadata: {
            user_id: user.id,
            plan,
          },
        },

        success_url:
          `${APP_URL}/app.html?checkout=success&session_id={CHECKOUT_SESSION_ID}`,

        cancel_url:
          `${APP_URL}/app.html?checkout=cancelled`,
      });

    return res.status(200).json({
      url: session.url,
    });

  } catch (error) {
    console.error(
      "ChoiceGrade checkout error:",
      error
    );

    return res.status(500).json({
      error: "Unable to start Stripe Checkout",
    });
  }
      }
