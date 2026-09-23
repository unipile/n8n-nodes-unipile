import type { IAuthenticateGeneric, ICredentialTestRequest, ICredentialType, INodeProperties } from "n8n-workflow";

export class UnipileApi implements ICredentialType {
  name = "unipileApi";
  displayName = "Unipile API";
  icon = "file:../nodes/Unipile/unipile.svg" as const;
  documentationUrl = "https://developer.unipile.com/docs/mcp";
  properties: INodeProperties[] = [
    {
      displayName: "API Key",
      name: "apiKey",
      type: "string",
      typeOptions: { password: true },
      default: "",
      required: true,
      description: "Scoped Account API key from your Unipile dashboard. Sent as the X-API-KEY header.",
    },
  ];
  authenticate: IAuthenticateGeneric = {
    type: "generic",
    properties: { headers: { "X-API-KEY": "={{$credentials.apiKey}}" } },
  };
  test: ICredentialTestRequest = {
    request: {
      baseURL: "https://api.unipile.com/v2",
      url: "/accounts",
      method: "GET",
    },
  };
}
