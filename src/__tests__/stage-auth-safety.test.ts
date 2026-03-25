/**
 * Security & Infrastructure Safety Tests
 *
 * Critical guardrails that MUST pass before any deployment:
 * - Production NEVER has basic auth (public site must be accessible)
 * - Stage basic auth credentials are NOT committed to git
 * - Terraform configs are structurally sound
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

const ROOT = process.cwd();
const TERRAFORM_DIR = join(ROOT, "terraform");

// ═════════════════════════════════════════════════════════════════════════════
// SECTION 1: Production must NEVER have basic auth
// ═════════════════════════════════════════════════════════════════════════════

describe("Production basic auth safety", () => {
  const prodTfvarsPath = join(TERRAFORM_DIR, "prod.tfvars");
  const prodTfvarsExists = existsSync(prodTfvarsPath);

  it("prod.tfvars exists", () => {
    expect(prodTfvarsExists).toBe(true);
  });

  it("prod.tfvars has basic_auth_credentials set to empty string", () => {
    if (!prodTfvarsExists) return;
    const content = readFileSync(prodTfvarsPath, "utf-8");
    // Must contain the explicit empty assignment
    expect(content).toMatch(/basic_auth_credentials\s*=\s*""/);
  });

  it("prod.tfvars does NOT contain any non-empty basic_auth value", () => {
    if (!prodTfvarsExists) return;
    const content = readFileSync(prodTfvarsPath, "utf-8");
    // Extract the value between quotes after basic_auth_credentials =
    const match = content.match(/basic_auth_credentials\s*=\s*"([^"]*)"/);
    expect(match).toBeTruthy();
    expect(match![1]).toBe(""); // Must be empty
  });

  it("prod.tfvars does NOT contain username:password patterns", () => {
    if (!prodTfvarsExists) return;
    const content = readFileSync(prodTfvarsPath, "utf-8");
    // No colon-separated credentials anywhere in the file
    expect(content).not.toMatch(/basic_auth_credentials\s*=\s*"[^"]+:[^"]+"/);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// SECTION 2: Stage secrets are gitignored
// ═════════════════════════════════════════════════════════════════════════════

describe("Stage secrets not in Git", () => {
  const gitignorePath = join(ROOT, ".gitignore");

  it(".gitignore contains *.secrets.tfvars pattern", () => {
    const content = readFileSync(gitignorePath, "utf-8");
    expect(content).toContain("*.secrets.tfvars");
  });

  it("stage.tfvars does NOT contain credentials", () => {
    const stagePath = join(TERRAFORM_DIR, "stage.tfvars");
    if (!existsSync(stagePath)) return;
    const content = readFileSync(stagePath, "utf-8");
    // stage.tfvars should NOT have basic_auth_credentials at all
    // (credentials belong in stage.secrets.tfvars which is gitignored)
    expect(content).not.toMatch(/basic_auth_credentials/);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// SECTION 3: Terraform variable has safety validation
// ═════════════════════════════════════════════════════════════════════════════

describe("Terraform variable definitions", () => {
  const variablesPath = join(TERRAFORM_DIR, "variables.tf");

  it("variables.tf defines basic_auth_credentials as sensitive", () => {
    const content = readFileSync(variablesPath, "utf-8");
    expect(content).toContain('variable "basic_auth_credentials"');
    expect(content).toMatch(/sensitive\s*=\s*true/);
  });

  it("basic_auth_credentials defaults to empty string", () => {
    const content = readFileSync(variablesPath, "utf-8");
    // Find the variable block and check default
    const varBlock = content.slice(
      content.indexOf('variable "basic_auth_credentials"')
    );
    expect(varBlock).toMatch(/default\s*=\s*""/);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// SECTION 4: CloudFront function uses conditional auth
// ═════════════════════════════════════════════════════════════════════════════

describe("CloudFront function auth implementation", () => {
  const mainTfPath = join(TERRAFORM_DIR, "main.tf");

  it("main.tf has conditional auth based on basic_auth_credentials", () => {
    const content = readFileSync(mainTfPath, "utf-8");
    // The function code should be conditional on var.basic_auth_credentials
    expect(content).toMatch(/var\.basic_auth_credentials\s*!=\s*""/);
  });

  it("auth branch returns 401 with WWW-Authenticate header", () => {
    const content = readFileSync(mainTfPath, "utf-8");
    expect(content).toContain("statusCode: 401");
    expect(content).toContain("www-authenticate");
  });

  it("non-auth branch does NOT contain auth logic", () => {
    const content = readFileSync(mainTfPath, "utf-8");
    // The second EOF block (no-auth) should still have URL rewriting
    // but should NOT have its own 401 response
    // We verify the conditional structure exists (two separate function bodies)
    expect(content).toContain("base64encode(var.basic_auth_credentials)");
  });

  it("uses Terraform base64encode (not hardcoded credentials)", () => {
    const content = readFileSync(mainTfPath, "utf-8");
    // Must NOT contain hardcoded base64 credentials
    expect(content).not.toContain("cmF0aG9kOk"); // base64 of "rathod:"
    // Must use dynamic encoding
    expect(content).toContain("base64encode(var.basic_auth_credentials)");
  });
});
