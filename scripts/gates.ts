#!/usr/bin/env bun
/**
 * Run all required gates for OpenShaderGraph
 * 
 * This script executes all validation gates defined in AGENTS.md and reports
 * pass/fail status for each. Exit code is non-zero if any gate fails.
 */

import { spawn } from "bun";
import { existsSync } from "fs";

// ANSI color codes
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

interface GateResult {
  name: string;
  command: string;
  passed: boolean;
  duration: number;
  output: string;
  error: string;
}

const gates = [
  {
    name: "Dependencies Check",
    command: "bun install --frozen-lockfile",
    description: "Verify dependencies are locked and installable",
  },
  {
    name: "Linter",
    command: "bun run lint",
    description: "ESLint with max-warnings=0",
  },
  {
    name: "Type Check",
    command: "bun x tsc -p tsconfig.json --noEmit",
    description: "TypeScript strict type checking",
  },
  {
    name: "Unit Tests",
    command: "bun run test",
    description: "Vitest unit tests",
  },
  {
    name: "Test Coverage",
    command: "bun run test:coverage",
    description: "Coverage meets threshold (lines/statements ≥ 43%)",
  },
  {
    name: "E2E Tests",
    command: "bun run test:e2e",
    description: "Playwright E2E tests (Chromium)",
  },
  {
    name: "Shader Validation",
    command: "bun run validate:shaders",
    description: "All shaders compile successfully",
  },
];

async function runCommand(command: string): Promise<{ success: boolean; output: string; error: string }> {
  const parts = command.split(" ");
  const proc = spawn({
    cmd: parts,
    stdout: "pipe",
    stderr: "pipe",
  });

  const output = await new Response(proc.stdout).text();
  const error = await new Response(proc.stderr).text();
  const exitCode = await proc.exited;

  return {
    success: exitCode === 0,
    output,
    error,
  };
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function printHeader() {
  console.log(`${colors.bright}${colors.cyan}╔════════════════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}║${colors.reset}  ${colors.bright}OpenShaderGraph - Gate Validation${colors.reset}                       ${colors.cyan}║${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}╚════════════════════════════════════════════════════════════════╝${colors.reset}\n`);
}

function printGateStart(gateName: string, description: string, index: number, total: number) {
  console.log(`${colors.bright}[${index}/${total}]${colors.reset} ${colors.blue}${gateName}${colors.reset}`);
  console.log(`      ${colors.cyan}→${colors.reset} ${description}`);
}

function printGateResult(result: GateResult) {
  const status = result.passed
    ? `${colors.green}✓ PASS${colors.reset}`
    : `${colors.red}✗ FAIL${colors.reset}`;
  
  console.log(`      ${status} ${colors.yellow}(${formatDuration(result.duration)})${colors.reset}\n`);
  
  if (!result.passed) {
    console.log(`${colors.red}${colors.bright}      Output:${colors.reset}`);
    if (result.output) {
      console.log(`${colors.red}${result.output}${colors.reset}`);
    }
    if (result.error) {
      console.log(`${colors.red}${result.error}${colors.reset}`);
    }
    console.log();
  }
}

function printSummary(results: GateResult[], totalDuration: number) {
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const allPassed = failed === 0;

  console.log(`${colors.bright}${colors.cyan}╔════════════════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}║${colors.reset}  ${colors.bright}Summary${colors.reset}                                                      ${colors.cyan}║${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}╚════════════════════════════════════════════════════════════════╝${colors.reset}\n`);

  console.log(`  Total Gates:     ${colors.bright}${results.length}${colors.reset}`);
  console.log(`  Passed:          ${colors.green}${colors.bright}${passed}${colors.reset}`);
  console.log(`  Failed:          ${failed > 0 ? colors.red : colors.green}${colors.bright}${failed}${colors.reset}`);
  console.log(`  Total Duration:  ${colors.yellow}${formatDuration(totalDuration)}${colors.reset}\n`);

  if (!allPassed) {
    console.log(`${colors.red}${colors.bright}Failed Gates:${colors.reset}`);
    results
      .filter((r) => !r.passed)
      .forEach((r) => {
        console.log(`  ${colors.red}✗${colors.reset} ${r.name} ${colors.yellow}(${r.command})${colors.reset}`);
      });
    console.log();
  }

  if (allPassed) {
    console.log(`${colors.green}${colors.bright}✓ All gates passed! Ready for production.${colors.reset}\n`);
  } else {
    console.log(`${colors.red}${colors.bright}✗ Some gates failed. Please fix the issues above.${colors.reset}\n`);
  }
}

async function checkPrerequisites(): Promise<boolean> {
  // Check if Chromium is installed for E2E tests
  const playwrightPath = "./.cache/ms-playwright";
  const hasPlaywright = existsSync(playwrightPath);
  
  if (!hasPlaywright) {
    console.log(`${colors.yellow}${colors.bright}⚠ Warning:${colors.reset} Playwright Chromium not detected.`);
    console.log(`${colors.yellow}  Run: ${colors.bright}bun run test:e2e:install${colors.reset}${colors.yellow} before running E2E tests.${colors.reset}\n`);
    return false;
  }
  
  return true;
}

async function main() {
  printHeader();

  // Get Bun version
  const bunVersion = Bun.version;
  console.log(`${colors.cyan}Bun Version:${colors.reset} ${bunVersion}`);
  console.log(`${colors.cyan}Working Directory:${colors.reset} ${process.cwd()}\n`);

  // Check prerequisites
  const hasPrereqs = await checkPrerequisites();
  if (!hasPrereqs) {
    console.log(`${colors.yellow}Continuing with available gates...${colors.reset}\n`);
  }

  const results: GateResult[] = [];
  const startTime = performance.now();

  for (let i = 0; i < gates.length; i++) {
    const gate = gates[i];
    printGateStart(gate.name, gate.description, i + 1, gates.length);

    const gateStartTime = performance.now();
    const result = await runCommand(gate.command);
    const gateEndTime = performance.now();

    const gateResult: GateResult = {
      name: gate.name,
      command: gate.command,
      passed: result.success,
      duration: gateEndTime - gateStartTime,
      output: result.output,
      error: result.error,
    };

    results.push(gateResult);
    printGateResult(gateResult);

    // Stop on first failure if desired (currently continues)
    // if (!result.success) break;
  }

  const endTime = performance.now();
  const totalDuration = endTime - startTime;

  printSummary(results, totalDuration);

  // Exit with error code if any gate failed
  const hasFailures = results.some((r) => !r.passed);
  process.exit(hasFailures ? 1 : 0);
}

main().catch((error) => {
  console.error(`${colors.red}${colors.bright}Fatal error:${colors.reset}`, error);
  process.exit(1);
});

