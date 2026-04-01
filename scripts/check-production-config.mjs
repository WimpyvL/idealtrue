import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const forbiddenHost = "staging-ideal-stay-online-gh5i.encr.app";
const ignoredPatterns = [
  `${path.sep}.git${path.sep}`,
  `${path.sep}dist${path.sep}`,
  `${path.sep}node_modules${path.sep}`,
  `${path.sep}.encore${path.sep}`,
  `${path.sep}encore.gen${path.sep}`,
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

if (offenders.length > 0) {
  console.error("Production config check failed. Remove the hardcoded staging Encore host from:");
  for (const offender of offenders) {
    console.error(`- ${path.relative(repoRoot, offender)}`);
  }
  process.exit(1);
}

console.log("Production config check passed.");
