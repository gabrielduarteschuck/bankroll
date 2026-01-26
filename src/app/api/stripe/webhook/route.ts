import Stripe from "stripe";
import { NextResponse } from "next/server";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY || "";
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

// Logging helper - aparece nos logs do Vercel
function log(context: string, data: Record<string, unknown>) {
  console.log(`[STRIPE_WEBHOOK] ${context}:`, JSON.stringify(data, null, 2));
}

function requireEnv(name: string, value: string) {
  if (!value) {
    log("ENV_MISSING", { name, available: Object.keys(process.env).filter(k => k.includes("STRIPE") || k.includes("SUPABASE")) });
    throw new Error(`Missing env: ${name}`);
  }
}

function normalizeEmail(v: unknown): string | null {
  const email = String(v || "").trim().toLowerCase();
  return email ? email : null;
}

function pickCheckoutEmail(session: Stripe.Checkout.Session): string | null {
  return normalizeEmail(session.customer_details?.email || (session as any)?.customer_email);
}

function pickInvoiceEmail(invoice: Stripe.Invoice): string | null {
  return normalizeEmail(
    (invoice as any)?.customer_email ||
      invoice.customer_email ||
      (invoice as any)?.customer_details?.email
  );
}

async function resolveCustomerEmail(
  stripe: Stripe,
  customer: Stripe.Invoice["customer"] | Stripe.Subscription["customer"] | Stripe.Checkout.Session["customer"]
): Promise<string | null> {
  const customerId = typeof customer === "string" ? customer : null;
  if (!customerId) return null;
  try {
    const c = await stripe.customers.retrieve(customerId);
    return normalizeEmail((c as any)?.email);
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  log("REQUEST_RECEIVED", { timestamp: new Date().toISOString() });

  try {
    requireEnv("STRIPE_SECRET_KEY", stripeSecretKey);
    requireEnv("STRIPE_WEBHOOK_SECRET", stripeWebhookSecret);
    requireEnv("NEXT_PUBLIC_SUPABASE_URL", supabaseUrl);
    requireEnv("SUPABASE_SERVICE_ROLE_KEY", supabaseServiceKey);

    log("ENV_VALIDATED", {
      hasStripeKey: !!stripeSecretKey,
      hasWebhookSecret: !!stripeWebhookSecret,
      supabaseUrl: supabaseUrl.slice(0, 30) + "..."
    });

    const stripe = new Stripe(stripeSecretKey);

    const signature = req.headers.get("stripe-signature");
    if (!signature) {
      log("ERROR", { reason: "Missing stripe-signature" });
      return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });
    }

    const rawBody = await req.text();
    const event = stripe.webhooks.constructEvent(rawBody, signature, stripeWebhookSecret);

    log("EVENT_RECEIVED", { type: event.type, id: event.id });

    // Import dinâmico para manter no server-side
    const { createClient } = await import("@supabase/supabase-js");
    const admin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    async function upsertByEmail(email: string, patch: Record<string, unknown>) {
      log("UPSERT_START", { email, patch });

      // Evita depender de UNIQUE(email) (muitos setups usam índice em lower(email)).
      // Estratégia: tenta UPDATE por email; se não existir, faz INSERT.
      const updateRes = await admin
        .from("stripe_payments")
        .update({ updated_at: new Date().toISOString(), ...patch })
        .eq("email", email)
        .select("id");

      if (updateRes.error) {
        log("UPSERT_UPDATE_ERROR", { email, error: updateRes.error });
        throw updateRes.error;
      }

      if (Array.isArray(updateRes.data) && updateRes.data.length > 0) {
        log("UPSERT_UPDATED", { email, rowsAffected: updateRes.data.length });
        return;
      }

      log("UPSERT_NO_EXISTING_ROW", { email, insertingNew: true });
      const insertRes = await admin
        .from("stripe_payments")
        .insert({ email, updated_at: new Date().toISOString(), ...patch });

      if (insertRes.error) {
        log("UPSERT_INSERT_ERROR", { email, error: insertRes.error });
        throw insertRes.error;
      }

      log("UPSERT_INSERTED", { email, success: true });
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const email = pickCheckoutEmail(session) || (await resolveCustomerEmail(stripe, session.customer));

      log("CHECKOUT_COMPLETED", {
        sessionId: session.id,
        email,
        paymentStatus: session.payment_status,
        customerId: session.customer,
        subscriptionId: session.subscription
      });

      if (email) {
        const isPaid = session.payment_status === "paid";
        const paidAt = isPaid ? new Date().toISOString() : null;
        await upsertByEmail(email, {
          stripe_customer_id: typeof session.customer === "string" ? session.customer : null,
          checkout_session_id: session.id,
          payment_status: session.payment_status || null,
          is_paid: isPaid,
          paid_at: paidAt,
          subscription_id: typeof session.subscription === "string" ? session.subscription : null,
        });
        log("CHECKOUT_PROCESSED", { email, isPaid, success: true });
      } else {
        log("CHECKOUT_NO_EMAIL", { sessionId: session.id, warning: "Could not extract email from session" });
      }
    }

    if (event.type === "invoice.paid" || event.type === "invoice.payment_failed") {
      const invoice = event.data.object as Stripe.Invoice;
      const email = pickInvoiceEmail(invoice) || (await resolveCustomerEmail(stripe, invoice.customer));
      if (email) {
        const isPaidEvent = event.type === "invoice.paid";
        const patch: Record<string, any> = {
          stripe_customer_id: typeof invoice.customer === "string" ? invoice.customer : null,
          payment_status: isPaidEvent ? "paid" : "payment_failed",
          last_invoice_id: invoice.id,
          subscription_id:
            typeof (invoice as any)?.subscription === "string" ? (invoice as any).subscription : null,
        };

        // Importante: NÃO derrubar acesso apenas por invoice.payment_failed.
        // O acesso é decidido por checkout/subscription status.
        if (isPaidEvent) patch.paid_at = new Date().toISOString();

        await upsertByEmail(email, patch);
      }
    }

    if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      const sub = event.data.object as Stripe.Subscription;
      const subAny = sub as Record<string, unknown>;
      const email = (await resolveCustomerEmail(stripe, sub.customer)) || null;

      log("SUBSCRIPTION_EVENT", {
        eventType: event.type,
        subscriptionId: sub.id,
        email,
        status: subAny?.status,
        customerId: sub.customer
      });

      if (email) {
        const status = String(subAny?.status || "").toLowerCase();
        const isActive = status === "active" || status === "trialing";
        const isPaid = event.type === "customer.subscription.deleted" ? false : isActive;
        const periodEnd =
          typeof subAny?.current_period_end === "number"
            ? new Date((subAny.current_period_end as number) * 1000).toISOString()
            : null;

        await upsertByEmail(email, {
          stripe_customer_id: typeof sub.customer === "string" ? sub.customer : null,
          subscription_id: sub.id,
          subscription_status: subAny?.status || null,
          current_period_end: periodEnd,
          cancel_at_period_end: subAny?.cancel_at_period_end ?? null,
          is_paid: isPaid,
          paid_at: isPaid ? new Date().toISOString() : null,
          payment_status: subAny?.status || null,
        });
        log("SUBSCRIPTION_PROCESSED", { email, isPaid, status, success: true });
      } else {
        log("SUBSCRIPTION_NO_EMAIL", { subscriptionId: sub.id, warning: "Could not resolve email from customer" });
      }
    }

    log("WEBHOOK_SUCCESS", { eventType: event.type, eventId: event.id });
    return NextResponse.json({ received: true });
  } catch (err: unknown) {
    const errorObj = err as { message?: string };
    const message = typeof errorObj?.message === "string" ? errorObj.message : "Webhook error";
    log("WEBHOOK_ERROR", { message, errorType: typeof err });
    // Stripe recomenda retornar 400 em falha de validação de assinatura
    const status = message.toLowerCase().includes("signature") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

