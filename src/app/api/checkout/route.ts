import { NextResponse } from "next/server";
import Stripe from "stripe";

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  return new Stripe(key);
}

export async function POST(request: Request) {
  let body: {
    sessionId: string;
    email: string;
    pageCount: number;
    locale: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { sessionId, email, pageCount, locale } = body;

  if (!sessionId || !email || !pageCount) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 },
    );
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  if (!baseUrl) {
    return NextResponse.json(
      { error: "Server misconfiguration" },
      { status: 500 },
    );
  }

  const stripe = getStripe();

  // Build locale-aware paths: sl (default) has no prefix, others get /{locale}
  const localePrefix = locale === "sl" ? "" : `/${locale}`;
  const successUrl = `${baseUrl}${localePrefix}/convert/${sessionId}?step=confirmation`;
  const cancelUrl = `${baseUrl}${localePrefix}/convert/${sessionId}?step=billing`;

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: email,
    metadata: { sessionId, email },
    line_items: [
      {
        price_data: {
          currency: "eur",
          product_data: {
            name: "PDF/Image to EPUB Conversion",
          },
          unit_amount: 15, // 0.15 EUR in cents
        },
        quantity: Math.max(20, pageCount),
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
  });

  return NextResponse.json({ url: session.url });
}
