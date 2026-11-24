export type StoredProfile = {
  name: string;
  phone: string;
  email: string;
  accountMode: "customer" | "business";
};

export type StoredAppState = {
  profile?: StoredProfile;
  accountMode?: "customer" | "business";
  locationOn?: boolean;
  notifications?: boolean;
  cards?: { id: string; label: string; detail: string }[];
  cart?: { id: string; serviceId: string; providerId: string }[];
  chats?: Record<string, unknown[]>;
  bookings?: unknown[];
  posted?: unknown[];
  listing?: unknown;
  businessForm?: unknown;
  activeBookingId?: string | null;
};
