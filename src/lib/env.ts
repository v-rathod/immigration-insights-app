/**
 * Runtime environment detection.
 *
 * Hostname check takes priority over the NEXT_PUBLIC_APP_ENV build-time var.
 * This enables artifact promotion: the same JS bundle built for stage can be
 * deployed to prod and will correctly self-identify as "prod" based on the
 * hostname it is actually served from.
 *
 * Priority:
 *   1. window.location.hostname (runtime truth, client-side only)
 *   2. NEXT_PUBLIC_APP_ENV (build-time intent, used for SSR)
 *   3. NODE_ENV fallback
 */
export type AppEnv = "dev" | "stage" | "prod";

export function getEnvironment(): AppEnv {
  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;
    if (
      hostname === "immigrationcompass.fyi" ||
      hostname === "www.immigrationcompass.fyi"
    ) {
      return "prod";
    }
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname.startsWith("192.168.")
    ) {
      return "dev";
    }
    // stage CF domain (d10immmzyp7xgr.cloudfront.net), stage.immigrationcompass.fyi, etc.
    return "stage";
  }

  // SSR fallback: use the value baked in at build time by deploy.sh
  const fromEnv = process.env.NEXT_PUBLIC_APP_ENV as AppEnv | undefined;
  if (fromEnv === "prod" || fromEnv === "stage" || fromEnv === "dev") {
    return fromEnv;
  }

  return process.env.NODE_ENV === "production" ? "prod" : "dev";
}
