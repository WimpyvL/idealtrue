// (|/) Klaasvaakie
export type ListingAdminTagKey =
  | "payment_setup_review"
  | "ops_attention"
  | "special_conditions"
  | "contact_before_booking"
  | "verified_host_pick";

export function isListingAdminTagKey(value: unknown): value is ListingAdminTagKey {
  return (
    typeof value === "string" &&
    [
      "payment_setup_review",
      "ops_attention",
      "special_conditions",
      "contact_before_booking",
      "verified_host_pick",
    ].includes(value)
  );
}
