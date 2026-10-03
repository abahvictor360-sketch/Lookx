import type { Metadata } from "next";
import { PaymentStatus } from "./payment-status";

export const metadata: Metadata = { title: "Payment", robots: { index: false } };

/** Landing page after Paystack (popup success or hosted-checkout redirect). */
export default async function PaymentCallbackPage({ searchParams }: PageProps<"/payment/callback">) {
  const params = await searchParams;
  const reference = typeof params.reference === "string" ? params.reference : typeof params.trxref === "string" ? params.trxref : "";
  return (
    <div className="hero-glow flex flex-1 items-start justify-center px-4 py-16">
      <PaymentStatus reference={reference} />
    </div>
  );
}
