import { spawnSync } from "node:child_process";
import { readdirSync, rmSync, existsSync } from "node:fs";

// Collect both suites and generate the report even when a test fails.
// Keep every failed command visible in the process exit status.
for (const directory of ["allure-results", "allure-report"])
  rmSync(directory, { recursive: true, force: true });

let exitCode = 0;
for (const script of ["test:coverage", "test:e2e", "allure:generate"]) {
  if (script === "allure:generate" && (!existsSync("allure-results") || !readdirSync("allure-results").some((file) => file.endsWith("-result.json")))) {
    console.error("No Allure test results were produced; no report was generated.");
    exitCode = 1;
    break;
  }
  const result = spawnSync(process.platform === "win32" ? "npm.cmd" : "npm", ["run", script], {
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.error) console.error(result.error.message);
  if (result.status !== 0) exitCode = 1;
}
process.exitCode = exitCode;
