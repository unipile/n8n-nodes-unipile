import type { IDataObject, IExecuteFunctions, IHttpRequestMethods, ILoadOptionsFunctions } from "n8n-workflow";
import { NodeOperationError } from "n8n-workflow";

export function compact(o: IDataObject): IDataObject {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== ""));
}

export function parseJson(this: IExecuteFunctions | ILoadOptionsFunctions, value: unknown, label: string): IDataObject {
  if (value === undefined || value === null || value === "") return {};
  if (typeof value === "object") return value as IDataObject;
  try {
    return JSON.parse(String(value));
  } catch {
    throw new NodeOperationError(this.getNode(), `${label} is not valid JSON`);
  }
}

const V2_BASE_URL = "https://api.unipile.com/v2";

/** Base URL for the credential's API version: fixed for v2, the account's DSN + /api/v1 for v1. */
export async function unipileBaseUrl(this: IExecuteFunctions | ILoadOptionsFunctions): Promise<{ version: string; baseURL: string }> {
  const credentials = await this.getCredentials("unipileApi");
  const version = (credentials.apiVersion as string) || "v2";
  if (version !== "v1") return { version: "v2", baseURL: V2_BASE_URL };
  const dsn = String(credentials.dsn ?? "").trim().replace(/\/+$/, "");
  if (!dsn) throw new NodeOperationError(this.getNode(), "API v1 credential has no DSN");
  return { version, baseURL: `${dsn}/api/v1` };
}

/** Typed operations are written against API v2 routes. */
async function v2BaseUrl(this: IExecuteFunctions | ILoadOptionsFunctions): Promise<string> {
  const { version, baseURL } = await unipileBaseUrl.call(this);
  if (version === "v1") {
    throw new NodeOperationError(this.getNode(), "This operation uses API v2 routes. With an API v1 credential, use the Any Endpoint operation, or switch the credential to API v2.");
  }
  return baseURL;
}

/** Calls a Unipile V2 Method: path is relative to the connected account, e.g. "/chats" -> /v2/{account_id}/chats. */
export async function unipileMethod(
  this: IExecuteFunctions | ILoadOptionsFunctions,
  method: IHttpRequestMethods,
  accountId: string,
  path: string,
  body?: IDataObject,
  qs?: IDataObject,
): Promise<any> {
  return this.helpers.httpRequestWithAuthentication.call(this, "unipileApi", {
    method,
    baseURL: await v2BaseUrl.call(this),
    url: `/${encodeURIComponent(accountId)}${path}`,
    body,
    qs: qs && Object.keys(qs).length ? qs : undefined,
    json: true,
  });
}

/** Calls a Unipile V2 control-plane route (no account_id prefix), e.g. "/accounts" or "/auth/link". */
export async function unipileControlPlane(
  this: IExecuteFunctions | ILoadOptionsFunctions,
  method: IHttpRequestMethods,
  path: string,
  body?: IDataObject,
  qs?: IDataObject,
): Promise<any> {
  return this.helpers.httpRequestWithAuthentication.call(this, "unipileApi", {
    method,
    baseURL: await v2BaseUrl.call(this),
    url: path,
    body,
    qs: qs && Object.keys(qs).length ? qs : undefined,
    json: true,
  });
}

/** Escape hatch: an arbitrary Unipile request on the credential's API version, method/path/query/body all caller-supplied. */
export async function unipileAnyEndpoint(
  this: IExecuteFunctions,
  method: IHttpRequestMethods,
  path: string,
  body?: IDataObject,
  qs?: IDataObject,
): Promise<any> {
  const { baseURL } = await unipileBaseUrl.call(this);
  return this.helpers.httpRequestWithAuthentication.call(this, "unipileApi", {
    method,
    baseURL,
    url: path.startsWith("/") ? path : `/${path}`,
    body,
    qs: qs && Object.keys(qs).length ? qs : undefined,
    json: true,
  });
}
