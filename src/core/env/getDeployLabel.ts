export type DeployEnv = {
  DEPLOY?: string | null | undefined;
};

/**
 * Normalize the deploy label coming from the environment.
 * Falls back to "Local" when the variable is empty or undefined.
 */
export function getDeployLabel(env: DeployEnv): string {
  const raw = env?.DEPLOY;
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (trimmed.length > 0) return trimmed;
  }
  return "Local";
}
