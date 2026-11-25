"use client";

import { CheckoutView } from "@/components/velio/checkout";

export default function CheckoutPage() {
  return (
    <div className="flex min-h-dvh justify-center bg-[#E6E0D8] md:items-center md:p-4">
      <div className="flex h-dvh w-full max-w-phone flex-col overflow-hidden bg-white md:h-[calc(100dvh-2rem)] md:rounded-[2rem] md:shadow-2xl">
        <CheckoutView />
      </div>
    </div>
  );
}
