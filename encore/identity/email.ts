import { secret } from "encore.dev/config";

const resendApiKey = secret("RESEND_API_KEY");
const authEmailFrom = secret("AUTH_EMAIL_FROM");
const authEmailReplyTo = secret("AUTH_EMAIL_REPLY_TO");
const idealStayAppUrl = secret("IDEAL_STAY_APP_URL");
const allowAuthEmailLogFallback = process.env.IDEAL_STAY_ALLOW_AUTH_EMAIL_LOG === "true";

type AuthEmailKind = "verify_email" | "reset_password";

function readConfiguredSecret(secretValue: () => string, name: string) {
  try {
    return secretValue().trim();
  } catch (error) {
    if (error instanceof Error && error.message === `secret ${name} is not set`) {
      return "";
    }
    throw error;
  }
}

function getAppUrl() {
  const configuredUrl = readConfiguredSecret(idealStayAppUrl, "IDEAL_STAY_APP_URL");
  if (configuredUrl) {
    return configuredUrl;
  }

  if (allowAuthEmailLogFallback) {
    return "http://localhost:3000";
  }

  throw new Error(
    "Auth email app URL is not configured. Set IDEAL_STAY_APP_URL so verification and reset links point at the frontend.",
  );
}

function renderEmail(kind: AuthEmailKind, link: string, displayName: string) {
  if (kind === "verify_email") {
    return {
      subject: "Verify your Ideal Stay email",
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a">
          <h2>Verify your email</h2>
          <p>Hi ${displayName || "there"},</p>
          <p>Confirm your email address to secure your Ideal Stay account.</p>
          <p><a href="${link}" style="display:inline-block;padding:12px 18px;background:#0f766e;color:#fff;text-decoration:none;border-radius:8px">Verify email</a></p>
          <p>If the button does not work, use this link:</p>
          <p><a href="${link}">${link}</a></p>
        </div>
      `,
      text: `Verify your Ideal Stay email: ${link}`,
    };
  }

  return {
    subject: "Reset your Ideal Stay password",
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a">
        <h2>Reset your password</h2>
        <p>Hi ${displayName || "there"},</p>
        <p>Use the link below to set a new password for your Ideal Stay account.</p>
        <p><a href="${link}" style="display:inline-block;padding:12px 18px;background:#0f766e;color:#fff;text-decoration:none;border-radius:8px">Reset password</a></p>
        <p>If the button does not work, use this link:</p>
        <p><a href="${link}">${link}</a></p>
      </div>
    `,
    text: `Reset your Ideal Stay password: ${link}`,
  };
}

export async function sendAuthEmail(params: {
  to: string;
  displayName: string;
  kind: AuthEmailKind;
  token: string;
}) {
  const appUrl = getAppUrl().replace(/\/$/, "");
  const path =
    params.kind === "verify_email"
      ? `/signup?mode=verify-email&token=${encodeURIComponent(params.token)}`
      : `/signup?mode=reset-password&token=${encodeURIComponent(params.token)}`;
  const link = `${appUrl}${path}`;
  const rendered = renderEmail(params.kind, link, params.displayName);

  const apiKey = readConfiguredSecret(resendApiKey, "RESEND_API_KEY");
  const from = readConfiguredSecret(authEmailFrom, "AUTH_EMAIL_FROM");
  const replyTo = readConfiguredSecret(authEmailReplyTo, "AUTH_EMAIL_REPLY_TO");
  if (!apiKey || !from) {
    if (!allowAuthEmailLogFallback) {
      throw new Error(
        "Auth email transport is not configured. Set RESEND_API_KEY and AUTH_EMAIL_FROM, or explicitly enable local log fallback with IDEAL_STAY_ALLOW_AUTH_EMAIL_LOG=true.",
      );
    }
    console.log(`[auth-email:${params.kind}] ${params.to} -> ${link}`);
    return { delivery: "log" as const, link };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [params.to],
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      reply_to: replyTo || undefined,
    }),
  });

  const body = await response.text();
  if (!response.ok) {
    throw new Error(`Failed to send auth email: ${response.status} ${body}`);
  }

  return { delivery: "resend" as const, link };
}
