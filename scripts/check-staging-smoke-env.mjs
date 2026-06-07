function readEnv(name) {
  return `${process.env[name] || ""}`.trim();
}

function addError(message, details = "") {
  errors.push({ message, details });
}

function formatError(error) {
  return error.details ? `${error.message} ${error.details}` : error.message;
}

function isTruthy(value) {
  return ["1", "true", "yes", "on"].includes(`${value || ""}`.trim().toLowerCase());
}

function parseUrl(name, options = {}) {
  const value = readEnv(name);
  const { allowLocalhost = false, missingDetails = `Set repository secret ${name} for scheduled/manual staging smoke runs.` } = options;

  if (!value) {
    return {
      error: `${name} is required.`,
      details: missingDetails,
      parsed: null,
    };
  }

  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    return {
      error: `${name} must be a valid absolute URL.`,
      details: `Current value is not parseable as http(s) URL.`,
      parsed: null,
    };
  }

  if (!allowLocalhost && ["localhost", "127.0.0.1"].includes(parsed.hostname)) {
    return {
      error: `${name} cannot point at localhost in GitHub Actions.`,
      details: `Use the deployed staging service URL instead.`,
      parsed: null,
    };
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    return {
      error: `${name} must use http or https.`,
      details: `Use the deployed http(s) endpoint.`,
      parsed: null,
    };
  }

  return { error: null, details: "", parsed };
}

const requiredValues = [
  "IDEAL_STAY_DEMO_PASSWORD",
  "IDEAL_STAY_SEED_ADMIN_EMAIL",
  "IDEAL_STAY_SEED_ADMIN_PASSWORD",
  "IDEAL_STAY_SMOKE_ADMIN_EMAIL",
  "IDEAL_STAY_SMOKE_ADMIN_PASSWORD",
];

const errors = [];

for (const name of requiredValues) {
  if (!readEnv(name)) {
    addError(`${name} is required.`, `Set repository secret ${name}.`);
  }
}

const encoreApiUrl = parseUrl("ENCORE_API_URL");
const seedApiUrl = parseUrl("IDEAL_STAY_API_URL", {
  missingDetails:
    "The workflow should map this from repository secret ENCORE_API_URL; check the staging-smoke env block.",
});
const smokeBaseUrl = parseUrl("IDEAL_STAY_SMOKE_BASE_URL");

for (const result of [encoreApiUrl, seedApiUrl, smokeBaseUrl]) {
  if (result.error) {
    addError(result.error, result.details);
  }
}

if (!encoreApiUrl.error && !seedApiUrl.error && encoreApiUrl.parsed.toString() !== seedApiUrl.parsed.toString()) {
  addError(
    "ENCORE_API_URL and IDEAL_STAY_API_URL must match for the staging workflow.",
    "The workflow maps IDEAL_STAY_API_URL from ENCORE_API_URL; check the workflow env block before changing secrets.",
  );
}

if (!encoreApiUrl.error && !smokeBaseUrl.error && encoreApiUrl.parsed.origin === smokeBaseUrl.parsed.origin) {
  addError(
    "IDEAL_STAY_SMOKE_BASE_URL must point at the deployed frontend host, not the raw Encore API host.",
    "Set IDEAL_STAY_SMOKE_BASE_URL to the Vercel/frontend staging URL.",
  );
}

if (!isTruthy(readEnv("IDEAL_STAY_ALLOW_REMOTE_SEED"))) {
  addError(
    "IDEAL_STAY_ALLOW_REMOTE_SEED must be true in the staging workflow.",
    "This is workflow-owned and should remain true only inside the staging smoke job.",
  );
}

if (readEnv("IDEAL_STAY_SMOKE_GUEST_EMAIL") !== "guest.nomusa@idealstay.demo") {
  addError(
    "IDEAL_STAY_SMOKE_GUEST_EMAIL must stay aligned with the seeded smoke guest account.",
    "Use guest.nomusa@idealstay.demo.",
  );
}

if (readEnv("IDEAL_STAY_SMOKE_HOST_EMAIL") !== "thandi.mokoena@idealstay.demo") {
  addError(
    "IDEAL_STAY_SMOKE_HOST_EMAIL must stay aligned with the seeded smoke host account.",
    "Use thandi.mokoena@idealstay.demo.",
  );
}

if (readEnv("IDEAL_STAY_SMOKE_GUEST_PASSWORD") !== readEnv("IDEAL_STAY_DEMO_PASSWORD")) {
  addError(
    "IDEAL_STAY_SMOKE_GUEST_PASSWORD must match IDEAL_STAY_DEMO_PASSWORD.",
    "The workflow should map both from IDEAL_STAY_DEMO_PASSWORD.",
  );
}

if (readEnv("IDEAL_STAY_SMOKE_HOST_PASSWORD") !== readEnv("IDEAL_STAY_DEMO_PASSWORD")) {
  addError(
    "IDEAL_STAY_SMOKE_HOST_PASSWORD must match IDEAL_STAY_DEMO_PASSWORD.",
    "The workflow should map both from IDEAL_STAY_DEMO_PASSWORD.",
  );
}

if (errors.length > 0) {
  console.error("Staging smoke environment check failed:");
  for (const error of errors) {
    console.error(`- ${formatError(error)}`);
    console.error(`::error title=Staging smoke configuration::${formatError(error)}`);
  }
  process.exit(1);
}

console.log("Staging smoke environment check passed.");

// (|/) Klaasvaakie
