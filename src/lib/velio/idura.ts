import * as oidc from "openid-client";
import { appBaseUrl, env, iduraClientId, iduraConfigured, iduraIssuer } from "@/lib/velio/auth-config";
import { serverSecret } from "@/lib/velio/auth-secrets";
import {
  IDURA_METHODS,
  iduraRedirectUriFromBase,
  parseIduraClaims,
  type IduraMethod,
  type VerifiedEidIdentity,
} from "@/lib/velio/idura-claims";
import { openIduraTransaction, sealIduraTransaction, type IduraTransaction } from "@/lib/velio/idura-tx";

export const IDURA_TX_COOKIE = "velio_idura";

let configPromise: Promise<oidc.Configuration> | null = null;
let configKey = "";

async function configuration(): Promise<oidc.Configuration> {
  if (!iduraConfigured()) throw new Error("idura_not_configured");
  const secret = env("IDURA_CLIENT_SECRET");
  const issuer = iduraIssuer();
  const clientId = iduraClientId();
  const key = `${issuer}\n${clientId}\n${secret}`;
  if (!configPromise || configKey !== key) {
    configKey = key;
    configPromise = oidc
      .discovery(new URL(issuer), clientId, undefined, oidc.ClientSecretBasic(secret))
      .catch((error: unknown) => {
        configPromise = null;
        throw error;
      });
  }
  return configPromise;
}

export function iduraRedirectUri(request: Request): string {
  return iduraRedirectUriFromBase(appBaseUrl(request));
}

export async function beginIduraLogin(
  request: Request,
  method: IduraMethod,
): Promise<{ redirectTo: string; sealed: string }> {
  const config = await configuration();
  const acr = IDURA_METHODS[method];
  const codeVerifier = oidc.randomPKCECodeVerifier();
  const codeChallenge = await oidc.calculatePKCECodeChallenge(codeVerifier);
  const state = oidc.randomState();
  const nonce = oidc.randomNonce();
  const redirectTo = oidc.buildAuthorizationUrl(config, {
    redirect_uri: iduraRedirectUri(request),
    scope: "openid ssn",
    response_mode: "query",
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    state,
    nonce,
    acr_values: acr,
  });
  const issuerOrigin = new URL(iduraIssuer()).origin;
  if (redirectTo.origin !== issuerOrigin) {
    throw new Error("unexpected_authorize_endpoint");
  }
  const sealed = sealIduraTransaction(
    { state, nonce, codeVerifier, acr, method },
    serverSecret(),
  );
  return { redirectTo: redirectTo.href, sealed };
}

/**
 * Rebuild the callback on the registered redirect URI and copy the authorization
 * response onto it. The token request must send that exact redirect_uri.
 */
export async function iduraCallbackUrl(request: Request): Promise<URL> {
  const callback = new URL(iduraRedirectUri(request));
  const incoming = new URL(request.url);
  incoming.searchParams.forEach((value, key) => {
    callback.searchParams.append(key, value);
  });
  if (request.method === "POST") {
    const form = await request.formData();
    for (const [key, value] of form.entries()) {
      if (typeof value === "string") callback.searchParams.append(key, value);
    }
  }
  return callback;
}

export function readIduraTransaction(sealed: string): IduraTransaction {
  return openIduraTransaction(sealed, serverSecret());
}

/**
 * Authorization-code + PKCE exchange. openid-client checks the id_token
 * signature, issuer, audience, expiry, and the nonce we stored. State is
 * checked against the authorization response before the token request.
 */
export async function completeIduraLogin(callbackUrl: URL, tx: IduraTransaction): Promise<VerifiedEidIdentity> {
  const config = await configuration();
  const tokens = await oidc.authorizationCodeGrant(config, callbackUrl, {
    expectedState: tx.state,
    expectedNonce: tx.nonce,
    pkceCodeVerifier: tx.codeVerifier,
    idTokenExpected: true,
  });
  const claims = tokens.claims();
  if (!claims?.sub) throw new Error("missing_id_token");
  return parseIduraClaims(claims, tx.acr);
}

/** Log only an error name or code. OAuth client messages can contain a token or personnummer. */
export function redactIduraError(error: unknown): string {
  const code =
    error && typeof error === "object" && "code" in error && typeof error.code === "string" ? error.code : "";
  const name = error instanceof Error ? error.name : "Error";
  return (code ? `${name}:${code}` : name).slice(0, 80);
}
