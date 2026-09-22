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

/** Calls a Unipile V2 Method: path is relative to the connected account, e.g. "/chats" -> /v2/{account_id}/chats. */
export async function unipileMethod(
  this: IExecuteFunctions | ILoadOptionsFunctions,
  method: IHttpRequestMethods,
  accountId: string,
  path: string,
  body?: IDataObject,
  qs?: IDataObject,
): Promise<any> {
  const dsn = (await this.getCredentials("unipileApi")).dsn as string;
  return this.helpers.httpRequestWithAuthentication.call(this, "unipileApi", {
    method,
    baseURL: `${dsn}/v2`,
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
  const dsn = (await this.getCredentials("unipileApi")).dsn as string;
  return this.helpers.httpRequestWithAuthentication.call(this, "unipileApi", {
    method,
    baseURL: `${dsn}/v2`,
    url: path,
    body,
    qs: qs && Object.keys(qs).length ? qs : undefined,
    json: true,
  });
}

/** Escape hatch: an arbitrary Unipile V2 request, method/path/query/body all caller-supplied. */
export async function unipileAnyEndpoint(
  this: IExecuteFunctions,
  method: IHttpRequestMethods,
  path: string,
  body?: IDataObject,
  qs?: IDataObject,
): Promise<any> {
  const dsn = (await this.getCredentials("unipileApi")).dsn as string;
  return this.helpers.httpRequestWithAuthentication.call(this, "unipileApi", {
    method,
    baseURL: `${dsn}/v2`,
    url: path.startsWith("/") ? path : `/${path}`,
    body,
    qs: qs && Object.keys(qs).length ? qs : undefined,
    json: true,
  });
}
