import { useCallback, useEffect, useMemo, useState } from "react";
import type { UserProfile } from "@/types";
import { getMyKycSubmission, type KycSubmission } from "@/lib/ops-client";

type EffectiveKycStatus = "none" | "pending" | "verified" | "rejected";

export function useEffectiveKycStatus(profile: UserProfile | null) {
  const [submission, setSubmission] = useState<KycSubmission | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const refreshKycStatus = useCallback(async () => {
    if (!profile) {
      setSubmission(null);
      return;
    }

    setIsLoading(true);
    try {
      const nextSubmission = await getMyKycSubmission();
      setSubmission(nextSubmission);
    } catch (error) {
      console.error("Failed to load current KYC submission:", error);
      setSubmission(null);
    } finally {
      setIsLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    refreshKycStatus();
  }, [refreshKycStatus]);

  const effectiveKycStatus = useMemo<EffectiveKycStatus>(() => {
    if (profile?.kycStatus === "verified") {
      return "verified";
    }

    if (submission?.status) {
      return submission.status;
    }

    return profile?.kycStatus ?? "none";
  }, [profile?.kycStatus, submission?.status]);

  return {
    submission,
    effectiveKycStatus,
    isLoading,
    refreshKycStatus,
  };
}
