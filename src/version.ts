import { getDeployLabel } from "./core/env/getDeployLabel";

declare const __APP_VERSION__: string | undefined;
declare const __APP_COMMIT__: string | undefined;
declare const __APP_BUILD_DATE__: string | undefined;
declare const __APP_DIRTY__: boolean | undefined;
declare const __APP_DEPLOY__: string | undefined;

const processEnv = typeof process !== "undefined" ? process.env : undefined;

function coerceString(value: unknown, fallback: string): string {
  if (typeof value === "string" && value.trim().length > 0) return value.trim();
  return fallback;
}

function coerceBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "on"].includes(normalized)) return true;
    if (["false", "0", "no", "off"].includes(normalized)) return false;
  }
  return fallback;
}

const version =
  (typeof __APP_VERSION__ !== "undefined" && coerceString(__APP_VERSION__, "")) ||
  coerceString(processEnv?.APP_VERSION, "0.0.0");

const commit =
  (typeof __APP_COMMIT__ !== "undefined" && coerceString(__APP_COMMIT__, "")) ||
  coerceString(processEnv?.APP_COMMIT, "");

const buildDate =
  (typeof __APP_BUILD_DATE__ !== "undefined" && coerceString(__APP_BUILD_DATE__, "")) ||
  coerceString(processEnv?.APP_BUILD_DATE, "");

const dirty =
  typeof __APP_DIRTY__ !== "undefined"
    ? coerceBoolean(__APP_DIRTY__, false)
    : coerceBoolean(processEnv?.APP_DIRTY, false);

const deployFallback = getDeployLabel({ DEPLOY: processEnv?.DEPLOY });
const deploy =
  (typeof __APP_DEPLOY__ !== "undefined" && coerceString(__APP_DEPLOY__, "")) ||
  coerceString(processEnv?.APP_DEPLOY, deployFallback);

export const APP_VERSION = version;
export const APP_COMMIT = commit;
export const APP_BUILD_DATE = buildDate;
export const APP_DIRTY = dirty;
export const APP_DEPLOY = deploy;

export type AppVersionInfo = {
  version: string;
  commit: string;
  buildDate: string;
  dirty: boolean;
  deploy: string;
};

export const APP_VERSION_INFO: AppVersionInfo = {
  version: APP_VERSION,
  commit: APP_COMMIT,
  buildDate: APP_BUILD_DATE,
  dirty: APP_DIRTY,
  deploy: APP_DEPLOY,
};
