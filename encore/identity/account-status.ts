import type { AccountStatus } from "../shared/domain";

const ACCOUNT_STATUS_SUPPORT_MESSAGE = "Contact support if you think this is a mistake.";

export function buildAccountStatusBlockMessage(status: Exclude<AccountStatus, "active">, reason?: string | null) {
  const trimmedReason = reason?.trim();
  const prefix = status === "suspended" ? "This account is suspended." : "This account is deactivated.";

  if (!trimmedReason) {
    return `${prefix} ${ACCOUNT_STATUS_SUPPORT_MESSAGE}`;
  }

  return `${prefix} ${trimmedReason}`;
}

export function normalizeAccountStatusReason(status: AccountStatus, reason?: string | null) {
  if (status === "active") {
    return null;
  }

  const trimmed = reason?.trim();
  return trimmed ? trimmed.slice(0, 500) : null;
}

export function shouldPauseListingsForAccountStatus(status: AccountStatus) {
  return status === "suspended" || status === "deactivated";
}
