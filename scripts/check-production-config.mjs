import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const forbiddenHost = "staging-ideal-stay-online-gh5i.encr.app";
const encoreApiUrl = `${process.env.ENCORE_API_URL || ""}`.trim();
const geminiApiKey = `${process.env.GEMINI_API_KEY || ""}`.trim();
const allowStagingEncoreBackend =
  ["1", "true", "yes"].includes(`${process.env.ALLOW_STAGING_ENCORE_BACKEND || ""}`.trim().toLowerCase());
const isProductionLikeEnvironment =
  `${process.env.NODE_ENV || ""}`.trim().toLowerCase() === "production" ||
  ["preview", "production"].includes(`${process.env.VERCEL_ENV || ""}`.trim().toLowerCase());
const ignoredPatterns = [
  `${path.sep}.git${path.sep}`,
  `${path.sep}dist${path.sep}`,
  `${path.sep}node_modules${path.sep}`,
  `${path.sep}.encore${path.sep}`,
  `${path.sep}encore.gen${path.sep}`,
  `${path.sep}tests${path.sep}`,
];
const ignoredFiles = new Set([
  path.join(repoRoot, "package-lock.json"),
  path.join(repoRoot, "README.md"),
  path.join(repoRoot, ".env.local"),
  path.join(repoRoot, "scripts", "check-production-config.mjs"),
]);

function shouldSkip(filePath) {
  if (ignoredFiles.has(filePath)) {
    return true;
  }

  return ignoredPatterns.some((pattern) => filePath.includes(pattern));
}

function collectFiles(currentPath, results = []) {
  const stat = fs.statSync(currentPath);
  if (stat.isDirectory()) {
    for (const entry of fs.readdirSync(currentPath)) {
      collectFiles(path.join(currentPath, entry), results);
    }
    return results;
  }

  results.push(currentPath);
  return results;
}

const offenders = collectFiles(repoRoot)
  .filter((filePath) => !shouldSkip(filePath))
  .filter((filePath) => fs.readFileSync(filePath, "utf8").includes(forbiddenHost));

if (offenders.length > 0 && !(allowStagingEncoreBackend && encoreApiUrl.includes(forbiddenHost))) {
  console.error("Production config check failed. Remove the hardcoded staging Encore host from:");
  for (const offender of offenders) {
    console.error(`- ${path.relative(repoRoot, offender)}`);
  }
  process.exit(1);
}

if (isProductionLikeEnvironment && !encoreApiUrl) {
  console.error("Production config check failed. ENCORE_API_URL must be set for preview and production builds.");
  process.exit(1);
}

if (isProductionLikeEnvironment && !geminiApiKey) {
  console.error("Production config check failed. GEMINI_API_KEY must be set for preview and production builds.");
  process.exit(1);
}

if (isProductionLikeEnvironment && encoreApiUrl.includes(forbiddenHost) && !allowStagingEncoreBackend) {
  console.error(
    "Production config check failed. Set ALLOW_STAGING_ENCORE_BACKEND=true if you intentionally want to use staging as the backend.",
  );
  process.exit(1);
}

console.log("Production config check passed.");
