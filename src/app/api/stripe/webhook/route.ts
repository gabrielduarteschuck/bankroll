import Stripe from "stripe";
import { NextResponse } from "next/server";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY || "";
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

function requireEnv(name: string, value: string) {
  if (!value) throw new Error(`Missing env: ${name}`);
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
  try {
    requireEnv("STRIPE_SECRET_KEY", stripeSecretKey);
    requireEnv("STRIPE_WEBHOOK_SECRET", stripeWebhookSecret);
    requireEnv("NEXT_PUBLIC_SUPABASE_URL", supabaseUrl);
    requireEnv("SUPABASE_SERVICE_ROLE_KEY", supabaseServiceKey);

    const stripe = new Stripe(stripeSecretKey);

    const signature = req.headers.get("stripe-signature");
    if (!signature) {
      return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });
    }

    const rawBody = await req.text();
    const event = stripe.webhooks.constructEvent(rawBody, signature, stripeWebhookSecret);

    // Import dinâmico para manter no server-side
    const { createClient } = await import("@supabase/supabase-js");
    const admin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    async function upsertByEmail(email: string, patch: Record<string, any>) {
      await admin.from("stripe_payments").upsert(
        {
          email,
          updated_at: new Date().toISOString(),
          ...patch,
        },
        { onConflict: "email" }
      );
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const email = pickCheckoutEmail(session) || (await resolveCustomerEmail(stripe, session.customer));
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
      }
    }

    if (event.type === "invoice.paid" || event.type === "invoice.payment_failed") {
      const invoice = event.data.object as Stripe.Invoice;
      const email = pickInvoiceEmail(invoice) || (await resolveCustomerEmail(stripe, invoice.customer));
      if (email) {
        const isPaid = event.type === "invoice.paid";
        const paidAt = isPaid ? new Date().toISOString() : null;
        await upsertByEmail(email, {
          stripe_customer_id: typeof invoice.customer === "string" ? invoice.customer : null,
          payment_status: isPaid ? "paid" : "payment_failed",
          is_paid: isPaid,
          paid_at: paidAt,
          last_invoice_id: invoice.id,
          subscription_id:
            typeof (invoice as any)?.subscription === "string" ? (invoice as any).subscription : null,
        });
      }
    }

    if (
      event.type === "customer.subscription.created" ||
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      const sub = event.data.object as Stripe.Subscription;
      const subAny = sub as any;
      const email = (await resolveCustomerEmail(stripe, sub.customer)) || null;
      if (email) {
        const status = String(subAny?.status || "").toLowerCase();
        const isActive = status === "active" || status === "trialing";
        const isPaid = event.type === "customer.subscription.deleted" ? false : isActive;
        const periodEnd =
          typeof subAny?.current_period_end === "number"
            ? new Date(subAny.current_period_end * 1000).toISOString()
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
      }
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    const message = typeof err?.message === "string" ? err.message : "Webhook error";
    // Stripe recomenda retornar 400 em falha de validação de assinatura
    const status = message.toLowerCase().includes("signature") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

