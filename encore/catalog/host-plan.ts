import type { HostPlan } from "../shared/domain";

export function getMaxImagesForPlan(plan: HostPlan) {
  return plan === "standard" ? 10 : 20;
}

export function supportsListingVideo(plan: HostPlan) {
  return plan !== "standard";
}
