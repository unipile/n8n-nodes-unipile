import type { IAuthenticateGeneric, ICredentialTestRequest, ICredentialType, INodeProperties } from "n8n-workflow";

export class UnipileApi implements ICredentialType {
  name = "unipileApi";
  displayName = "Unipile API";
  icon = "file:../nodes/Unipile/unipile.svg" as const;
  documentationUrl = "https://developer.unipile.com/docs/mcp";
  properties: INodeProperties[] = [
    {
      displayName: "API Version",
      name: "apiVersion",
      type: "options",
      options: [
        { name: "API v2", value: "v2", description: "Base URL https://api.unipile.com/v2, scoped Account API key. Every operation of this node." },
        { name: "API v1 (Legacy)", value: "v1", description: "Base URL = your account's DSN + /api/v1. Any Endpoint operation only." },
      ],
      default: "v2",
    },
    {
      displayName: "API Key",
      name: "apiKey",
      type: "string",
      typeOptions: { password: true },
      default: "",
      required: true,
      description: "API v2: a scoped Account API key from your Unipile dashboard. API v1: the access token from your Unipile dashboard. Sent as the X-API-KEY header.",
    },
    {
      displayName: "DSN",
      name: "dsn",
      type: "string",
      default: "",
      required: true,
      placeholder: "https://api1.unipile.com:13111",
      description: "API v1 only: your account's DSN, protocol and port included, as shown in your Unipile dashboard",
      displayOptions: { show: { apiVersion: ["v1"] } },
    },
  ];
  authenticate: IAuthenticateGeneric = {
    type: "generic",
    properties: { headers: { "X-API-KEY": "={{$credentials.apiKey}}" } },
  };
  test: ICredentialTestRequest = {
    request: {
      baseURL: "={{$credentials.apiVersion === \"v1\" ? $credentials.dsn.replace(/\\/+$/, \"\") + \"/api/v1\" : \"https://api.unipile.com/v2\"}}",
      url: "/accounts",
      method: "GET",
    },
  };
}
