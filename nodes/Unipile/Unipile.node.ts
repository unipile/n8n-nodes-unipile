import type {
  IDataObject,
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
} from "n8n-workflow";
import { NodeConnectionTypes, NodeOperationError } from "n8n-workflow";
import { compact, parseJson, unipileAnyEndpoint, unipileControlPlane, unipileMethod } from "./GenericFunctions";

const show = (resource: string, operation?: string) => ({ show: { resource: [resource], ...(operation ? { operation: [operation] } : {}) } });

const accountIdField = (resource: string) => ({
  displayName: "Account ID",
  name: "accountId",
  type: "string" as const,
  default: "",
  required: true,
  description: "The connected Unipile account this call runs on (from Account → List). Every LinkedIn/messaging/email/calendar/post call needs one.",
  displayOptions: { show: { resource: [resource] } },
});

const keywordsField = (resource: string, operations: string[]) => ({
  displayName: "Keywords",
  name: "keywords",
  type: "string" as const,
  default: "",
  displayOptions: { show: { resource: [resource], operation: operations } },
});

const filtersField = (resource: string, operations: string[]) => ({
  displayName: "Additional Filters (JSON)",
  name: "filters",
  type: "json" as const,
  default: "{}",
  description: "Provider filter object merged into the request body, e.g. company/location/seniority IDs. Resolve human names to IDs first with \"Get Search Parameters\".",
  displayOptions: { show: { resource: [resource], operation: operations } },
});

export class Unipile implements INodeType {
  description: INodeTypeDescription = {
    displayName: "Unipile",
    name: "unipile",
    icon: "file:unipile.svg",
    group: ["transform"],
    version: 1,
    subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
    description: "LinkedIn (Classic, Sales Navigator, Recruiter), WhatsApp, Instagram, Telegram, Email and Calendar through the Unipile API v2",
    defaults: { name: "Unipile" },
    inputs: [NodeConnectionTypes.Main],
    outputs: [NodeConnectionTypes.Main],
    usableAsTool: true,
    credentials: [{ name: "unipileApi", required: true }],
    properties: [
      {
        displayName: "Resource",
        name: "resource",
        type: "options",
        noDataExpression: true,
        options: [
          { name: "Account", value: "account" },
          { name: "Any Endpoint", value: "anyEndpoint" },
          { name: "Calendar", value: "calendar" },
          { name: "Email", value: "email" },
          { name: "LinkedIn Classic", value: "linkedinClassic" },
          { name: "LinkedIn Recruiter", value: "linkedinRecruiter" },
          { name: "LinkedIn Sales Navigator", value: "linkedinSalesNavigator" },
          { name: "Messaging (WhatsApp, Instagram, Telegram, LinkedIn)", value: "messaging" },
          { name: "Post", value: "post" },
        ],
        default: "linkedinClassic",
      },

      // ---- Account (control plane, no account_id field) ----
      {
        displayName: "Operation",
        name: "operation",
        type: "options",
        noDataExpression: true,
        displayOptions: show("account"),
        options: [
          { name: "List Accounts", value: "list", action: "List connected accounts", description: "Every account reachable with this API key, with its unipile_account_id" },
          { name: "Get Account", value: "get", action: "Get one account", description: "Status, provider and identifier of one connected account" },
        ],
        default: "list",
      },
      { displayName: "Account ID", name: "getAccountId", type: "string", default: "", required: true, description: "unipile_account_id from List Accounts", displayOptions: show("account", "get") },

      // ---- LinkedIn Classic ----
      accountIdField("linkedinClassic"),
      {
        displayName: "Operation",
        name: "operation",
        type: "options",
        noDataExpression: true,
        displayOptions: show("linkedinClassic"),
        options: [
          { name: "Accept Invitation", value: "acceptInvitation", action: "Accept a received invitation", description: "request_id from List Invitations (received)" },
          { name: "Get Company Profile", value: "getCompanyProfile", action: "Get a company profile" },
          { name: "Get InMail Credits", value: "getInmailCredits", action: "Get inmail credits", description: "Remaining InMail balance for this account" },
          { name: "Get Profile", value: "getProfile", action: "Get a linkedin profile", description: "By public identifier (from a profile URL) or provider user ID; returns the stable ID used by write actions" },
          { name: "Get Search Parameters", value: "getSearchParameters", action: "Resolve a classic search filter", description: "Turns a human filter (location, company, industry…) into the provider ID search expects" },
          { name: "List Contracts", value: "listContracts", action: "List available linkedin contracts", description: "Classic, Recruiter or Sales Navigator seats on this account" },
          { name: "List Invitations", value: "listInvitations", action: "List sent or received invitations" },
          { name: "List My Relations", value: "listRelations", action: "List connections", description: "Of the connected account, or of another user_id" },
          { name: "Search Companies", value: "searchCompanies", action: "Search linkedin companies (classic)" },
          { name: "Search Jobs", value: "searchJobs", action: "Search linkedin job postings (classic)" },
          { name: "Search People", value: "searchPeople", action: "Search linkedin people (classic)", description: "Classic LinkedIn people search — keywords and provider filter IDs" },
          { name: "Search Posts", value: "searchPosts", action: "Search linkedin posts (classic)" },
          { name: "Send Invitation", value: "sendInvitation", action: "Send a connection request" },
        ],
        default: "getProfile",
      },
      { displayName: "Profile ID or Public Identifier", name: "userId", type: "string", default: "", required: true, placeholder: "john-doe, or ACoAA…", description: "The part after /in/ in the profile URL, or a stable provider user ID returned by a previous call", displayOptions: show("linkedinClassic", "getProfile") },
      { displayName: "Company ID or Identifier", name: "companyId", type: "string", default: "", required: true, displayOptions: show("linkedinClassic", "getCompanyProfile") },
      keywordsField("linkedinClassic", ["searchPeople", "searchCompanies", "searchJobs", "searchPosts"]),
      filtersField("linkedinClassic", ["searchPeople", "searchCompanies", "searchJobs", "searchPosts"]),
      { displayName: "Parameter Type", name: "parameterType", type: "string", default: "LOCATION", description: "e.g. LOCATION, COMPANY, INDUSTRY, SCHOOL — see the Unipile LinkedIn search parameters reference", required: true, displayOptions: show("linkedinClassic", "getSearchParameters") },
      { displayName: "Query", name: "parameterQuery", type: "string", default: "", description: "Free-text to resolve, e.g. a company name", displayOptions: show("linkedinClassic", "getSearchParameters") },
      { displayName: "Type", name: "invitationType", type: "options", options: [{ name: "Received", value: "received" }, { name: "Sent", value: "sent" }], default: "received", displayOptions: show("linkedinClassic", "listInvitations") },
      { displayName: "Request ID", name: "requestId", type: "string", default: "", required: true, description: "request.id from List Invitations (received)", displayOptions: show("linkedinClassic", "acceptInvitation") },
      { displayName: "User ID", name: "relationsUserId", type: "string", default: "me", description: "Leave as \"me\" for the connected account's own relations", displayOptions: show("linkedinClassic", "listRelations") },
      { displayName: "Recipient User ID", name: "inviteUserId", type: "string", default: "", required: true, description: "Stable provider user ID returned by Get Profile / Search People, never a URL or a name", displayOptions: show("linkedinClassic", "sendInvitation") },
      { displayName: "Message", name: "inviteMessage", type: "string", default: "", typeOptions: { rows: 3 }, displayOptions: show("linkedinClassic", "sendInvitation") },

      // ---- LinkedIn Sales Navigator ----
      accountIdField("linkedinSalesNavigator"),
      {
        displayName: "Operation",
        name: "operation",
        type: "options",
        noDataExpression: true,
        displayOptions: show("linkedinSalesNavigator"),
        options: [
          { name: "Get Search Parameters", value: "getSearchParameters", action: "Resolve a sales navigator search filter" },
          { name: "Search From URL", value: "searchFromUrl", action: "Run a sales navigator search from a url", description: "Paste a Sales Navigator search results URL the user already built" },
          { name: "Search People", value: "searchPeople", action: "Search leads (sales navigator)", description: "Requires a Sales Navigator seat on the connected account" },
        ],
        default: "searchPeople",
      },
      keywordsField("linkedinSalesNavigator", ["searchPeople"]),
      filtersField("linkedinSalesNavigator", ["searchPeople"]),
      { displayName: "Search URL", name: "searchUrl", type: "string", default: "", required: true, displayOptions: show("linkedinSalesNavigator", "searchFromUrl") },
      { displayName: "Parameter Type", name: "parameterType", type: "string", default: "LOCATION", required: true, displayOptions: show("linkedinSalesNavigator", "getSearchParameters") },
      { displayName: "Query", name: "parameterQuery", type: "string", default: "", displayOptions: show("linkedinSalesNavigator", "getSearchParameters") },

      // ---- LinkedIn Recruiter ----
      accountIdField("linkedinRecruiter"),
      {
        displayName: "Operation",
        name: "operation",
        type: "options",
        noDataExpression: true,
        displayOptions: show("linkedinRecruiter"),
        options: [
          { name: "Get Search Parameters", value: "getSearchParameters", action: "Resolve a recruiter search filter" },
          { name: "Search Candidates", value: "searchPeople", action: "Search candidates (recruiter)", description: "Get profile / search talent as a Recruiter seat — requires a Recruiter contract on the connected account" },
          { name: "Search From URL", value: "searchFromUrl", action: "Run a recruiter search from a url", description: "Paste a Recruiter search results URL the user already built" },
        ],
        default: "searchPeople",
      },
      keywordsField("linkedinRecruiter", ["searchPeople"]),
      filtersField("linkedinRecruiter", ["searchPeople"]),
      { displayName: "Search URL", name: "searchUrl", type: "string", default: "", required: true, displayOptions: show("linkedinRecruiter", "searchFromUrl") },
      { displayName: "Parameter Type", name: "parameterType", type: "string", default: "LOCATION", required: true, displayOptions: show("linkedinRecruiter", "getSearchParameters") },
      { displayName: "Query", name: "parameterQuery", type: "string", default: "", displayOptions: show("linkedinRecruiter", "getSearchParameters") },

      // ---- Messaging ----
      accountIdField("messaging"),
      {
        displayName: "Operation",
        name: "operation",
        type: "options",
        noDataExpression: true,
        displayOptions: show("messaging"),
        options: [
          { name: "Add Reaction", value: "addReaction", action: "React to a message", description: "WhatsApp, Instagram, Telegram or LinkedIn message" },
          { name: "Forward Message", value: "forwardMessage", action: "Forward a message to another chat" },
          { name: "Get Chat", value: "getChat", action: "Get one chat" },
          { name: "List Chats", value: "listChats", action: "List chats (whatsapp, instagram, telegram, linkedin)", description: "Same shared inbox routes across every messaging provider on this account" },
          { name: "List Messages", value: "listMessages", action: "List messages of a chat" },
          { name: "Send Message", value: "sendMessage", action: "Send a message in an existing chat" },
          { name: "Start Chat", value: "startChat", action: "Start a new chat / send a whatsapp, instagram or telegram message", description: "Creates the chat if it doesn't exist yet, from provider user ID(s)" },
        ],
        default: "sendMessage",
      },
      { displayName: "Chat ID", name: "chatId", type: "string", default: "", required: true, displayOptions: { show: { resource: ["messaging"], operation: ["getChat", "listMessages", "sendMessage", "forwardMessage", "addReaction"] } } },
      { displayName: "Message ID", name: "messageId", type: "string", default: "", required: true, displayOptions: show("messaging", "forwardMessage") },
      { displayName: "Message ID", name: "messageId", type: "string", default: "", required: true, displayOptions: show("messaging", "addReaction") },
      { displayName: "Target Chat ID", name: "targetChatId", type: "string", default: "", required: true, description: "Chat to forward the message into", displayOptions: show("messaging", "forwardMessage") },
      { displayName: "Reaction", name: "reaction", type: "string", default: "👍", required: true, displayOptions: show("messaging", "addReaction") },
      { displayName: "Recipient Provider User ID(s)", name: "usersIds", type: "string", default: "", required: true, description: "Stable provider user ID (from a profile/contact resolver), comma-separated for a group; never a display name or phone in plain text", displayOptions: show("messaging", "startChat") },
      { displayName: "Text", name: "text", type: "string", default: "", required: true, typeOptions: { rows: 4 }, displayOptions: { show: { resource: ["messaging"], operation: ["sendMessage", "startChat"] } } },
      { displayName: "Limit", name: "limit", type: "number", default: 50, typeOptions: { minValue: 1, maxValue: 250 }, displayOptions: show("messaging", "listChats") },

      // ---- Email ----
      accountIdField("email"),
      {
        displayName: "Operation",
        name: "operation",
        type: "options",
        noDataExpression: true,
        displayOptions: show("email"),
        options: [
          { name: "Get Email", value: "get", action: "Read one email" },
          { name: "List Emails", value: "list", action: "List emails (gmail, outlook, imap)" },
          { name: "List Folder Emails", value: "listFolderEmails", action: "List the emails of one folder" },
          { name: "List Folders", value: "listFolders", action: "List mailbox folders" },
          { name: "Mark as Read", value: "markRead", action: "Mark an email as read" },
          { name: "Mark as Unread", value: "markUnread", action: "Mark an email as unread" },
          { name: "Send Email", value: "send", action: "Send an email" },
        ],
        default: "list",
      },
      { displayName: "Limit", name: "limit", type: "number", default: 20, typeOptions: { minValue: 1, maxValue: 250 }, displayOptions: { show: { resource: ["email"], operation: ["list", "listFolderEmails"] } } },
      { displayName: "Folder ID", name: "folderId", type: "string", default: "", required: true, description: "folder.id from List Folders; never a folder display name", displayOptions: show("email", "listFolderEmails") },
      { displayName: "Email ID", name: "emailId", type: "string", default: "", required: true, displayOptions: show("email", "get") },
      { displayName: "Email ID", name: "emailId", type: "string", default: "", required: true, displayOptions: show("email", "markRead") },
      { displayName: "Email ID", name: "emailId", type: "string", default: "", required: true, displayOptions: show("email", "markUnread") },
      { displayName: "To", name: "to", type: "string", default: "", required: true, description: "Comma-separated addresses", displayOptions: show("email", "send") },
      { displayName: "CC", name: "cc", type: "string", default: "", displayOptions: show("email", "send") },
      { displayName: "BCC", name: "bcc", type: "string", default: "", displayOptions: show("email", "send") },
      { displayName: "Subject", name: "subject", type: "string", default: "", displayOptions: show("email", "send") },
      { displayName: "Plain Text", name: "plainText", type: "string", default: "", typeOptions: { rows: 6 }, displayOptions: show("email", "send") },
      { displayName: "HTML", name: "html", type: "string", default: "", typeOptions: { rows: 6 }, displayOptions: show("email", "send") },
      { displayName: "Reply To Message ID", name: "replyToMessageId", type: "string", default: "", description: "Provider email ID (Gmail/Outlook) or RFC822 Message-ID (IMAP) being answered", displayOptions: show("email", "send") },

      // ---- Calendar ----
      accountIdField("calendar"),
      {
        displayName: "Operation",
        name: "operation",
        type: "options",
        noDataExpression: true,
        displayOptions: show("calendar"),
        options: [
          { name: "Create Event", value: "createEvent", action: "Create a calendar event" },
          { name: "Delete Event", value: "deleteEvent", action: "Delete a calendar event" },
          { name: "Get Calendar", value: "getCalendar", action: "Get one calendar" },
          { name: "List Calendars", value: "listCalendars", action: "List google or outlook calendars" },
          { name: "List Events", value: "listEvents", action: "List events of a calendar" },
          { name: "RSVP Event", value: "rsvpEvent", action: "Respond to an event invitation" },
          { name: "Update Event", value: "updateEvent", action: "Update a calendar event" },
        ],
        default: "listEvents",
      },
      { displayName: "Calendar ID", name: "calendarId", type: "string", default: "", required: true, description: "calendar.id from List Calendars; never a calendar display name", displayOptions: { show: { resource: ["calendar"], operation: ["getCalendar", "listEvents", "createEvent", "updateEvent", "deleteEvent", "rsvpEvent"] } } },
      { displayName: "Event ID", name: "eventId", type: "string", default: "", required: true, displayOptions: { show: { resource: ["calendar"], operation: ["updateEvent", "deleteEvent", "rsvpEvent"] } } },
      { displayName: "Start (ISO 8601)", name: "start", type: "string", default: "", displayOptions: show("calendar", "listEvents") },
      { displayName: "End (ISO 8601)", name: "end", type: "string", default: "", displayOptions: show("calendar", "listEvents") },
      { displayName: "Title", name: "title", type: "string", default: "", required: true, displayOptions: show("calendar", "createEvent") },
      { displayName: "Start (ISO 8601)", name: "eventStart", type: "string", default: "", required: true, displayOptions: show("calendar", "createEvent") },
      { displayName: "End (ISO 8601)", name: "eventEnd", type: "string", default: "", required: true, displayOptions: show("calendar", "createEvent") },
      { displayName: "Attendee Emails", name: "attendees", type: "string", default: "", description: "Comma-separated", displayOptions: show("calendar", "createEvent") },
      { displayName: "Fields (JSON)", name: "eventFields", type: "json", default: "{}", description: "Any additional event fields (location, description, all_day…), merged into the request body", displayOptions: { show: { resource: ["calendar"], operation: ["createEvent", "updateEvent"] } } },
      { displayName: "Response", name: "rsvpStatus", type: "options", options: [{ name: "Yes", value: "yes" }, { name: "Maybe", value: "maybe" }, { name: "No", value: "no" }], default: "yes", displayOptions: show("calendar", "rsvpEvent") },

      // ---- Post ----
      accountIdField("post"),
      {
        displayName: "Operation",
        name: "operation",
        type: "options",
        noDataExpression: true,
        displayOptions: show("post"),
        options: [
          { name: "Add Reaction", value: "addReaction", action: "React to a post" },
          { name: "Comment Post", value: "comment", action: "Comment on a post" },
          { name: "Create Post", value: "create", action: "Publish a post" },
          { name: "Get Post", value: "get", action: "Get one post" },
          { name: "List Comments", value: "listComments", action: "List a post's comments" },
        ],
        default: "create",
      },
      { displayName: "Post ID", name: "postId", type: "string", default: "", required: true, displayOptions: { show: { resource: ["post"], operation: ["get", "comment", "listComments", "addReaction"] } } },
      { displayName: "Text", name: "text", type: "string", default: "", required: true, typeOptions: { rows: 4 }, displayOptions: { show: { resource: ["post"], operation: ["create", "comment"] } } },
      { displayName: "Reaction", name: "reaction", type: "options", options: [{ name: "Like", value: "like" }, { name: "Celebrate", value: "celebrate" }, { name: "Support", value: "support" }, { name: "Love", value: "love" }, { name: "Insightful", value: "insightful" }, { name: "Funny", value: "funny" }], default: "like", displayOptions: show("post", "addReaction") },

      // ---- Any Endpoint ----
      { displayName: "Method", name: "anyMethod", type: "options", options: ["GET", "POST", "PATCH", "PUT", "DELETE"].map((m) => ({ name: m, value: m })), default: "GET", displayOptions: show("anyEndpoint") },
      { displayName: "Path", name: "anyPath", type: "string", default: "", required: true, placeholder: "/{account_id}/linkedin/recruiter/applicants/{applicant_id}", description: "Path relative to the API base https://api.unipile.com/v2, including any {account_id}. Use Search/Get Endpoint on the Unipile MCP, or the developer docs, to find it.", displayOptions: show("anyEndpoint") },
      { displayName: "Query (JSON)", name: "anyQuery", type: "json", default: "{}", displayOptions: show("anyEndpoint") },
      { displayName: "Body (JSON)", name: "anyBody", type: "json", default: "{}", displayOptions: show("anyEndpoint") },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const output: INodeExecutionData[] = [];
    const resource = this.getNodeParameter("resource", 0) as string;
    const operation = this.getNodeParameter("operation", 0) as string;
    const str = (name: string, index: number) => String(this.getNodeParameter(name, index, "") ?? "").trim();
    const addresses = (value: string) => value.split(",").map((e) => e.trim()).filter(Boolean).map((email) => ({ email }));
    const ids = (value: string) => value.split(",").map((v) => v.trim()).filter(Boolean);

    for (let index = 0; index < items.length; index++) {
      try {
        let result: unknown;
        const accountId = resource === "account" || resource === "anyEndpoint" ? "" : str("accountId", index);
        const filters = () => parseJson.call(this, this.getNodeParameter("filters", index, "{}"), "Additional Filters");
        const keywords = () => compact({ keywords: str("keywords", index) });

        if (resource === "account") {
          if (operation === "list") result = await unipileControlPlane.call(this, "GET", "/accounts");
          else result = await unipileControlPlane.call(this, "GET", `/accounts/${encodeURIComponent(str("getAccountId", index))}`);
        } else if (resource === "linkedinClassic") {
          if (operation === "getProfile") result = await unipileMethod.call(this, "GET", accountId, `/users/${encodeURIComponent(str("userId", index))}`);
          else if (operation === "searchPeople") result = await unipileMethod.call(this, "POST", accountId, "/linkedin/search/people", { ...keywords(), ...filters() });
          else if (operation === "searchCompanies") result = await unipileMethod.call(this, "POST", accountId, "/linkedin/search/companies", { ...keywords(), ...filters() });
          else if (operation === "searchJobs") result = await unipileMethod.call(this, "POST", accountId, "/linkedin/search/jobs", { ...keywords(), ...filters() });
          else if (operation === "searchPosts") result = await unipileMethod.call(this, "POST", accountId, "/linkedin/search/posts", { ...keywords(), ...filters() });
          else if (operation === "getSearchParameters") result = await unipileMethod.call(this, "GET", accountId, "/linkedin/search/parameters", undefined, compact({ type: str("parameterType", index), keywords: str("parameterQuery", index) }));
          else if (operation === "getCompanyProfile") result = await unipileMethod.call(this, "GET", accountId, `/linkedin/company/${encodeURIComponent(str("companyId", index))}`);
          else if (operation === "sendInvitation") result = await unipileMethod.call(this, "POST", accountId, "/users/me/relation-requests", compact({ user_id: str("inviteUserId", index), message: str("inviteMessage", index) }));
          else if (operation === "listInvitations") result = await unipileMethod.call(this, "GET", accountId, "/users/me/relation-requests", undefined, { type: str("invitationType", index) || "received" });
          else if (operation === "acceptInvitation") result = await unipileMethod.call(this, "POST", accountId, `/users/me/relation-requests/${encodeURIComponent(str("requestId", index))}/accept`);
          else if (operation === "listRelations") result = await unipileMethod.call(this, "GET", accountId, `/users/${encodeURIComponent(str("relationsUserId", index) || "me")}/relations`);
          else if (operation === "getInmailCredits") result = await unipileMethod.call(this, "GET", accountId, "/linkedin/inmail-credits");
          else result = await unipileMethod.call(this, "GET", accountId, "/linkedin/contracts");
        } else if (resource === "linkedinSalesNavigator") {
          if (operation === "searchPeople") result = await unipileMethod.call(this, "POST", accountId, "/linkedin/sales-navigator/search/people", { ...keywords(), ...filters() });
          else if (operation === "searchFromUrl") result = await unipileMethod.call(this, "POST", accountId, "/linkedin/sales-navigator/search", { url: str("searchUrl", index) });
          else result = await unipileMethod.call(this, "GET", accountId, "/linkedin/sales-navigator/search/parameters", undefined, compact({ type: str("parameterType", index), keywords: str("parameterQuery", index) }));
        } else if (resource === "linkedinRecruiter") {
          if (operation === "searchPeople") result = await unipileMethod.call(this, "POST", accountId, "/linkedin/recruiter/search/people", { ...keywords(), ...filters() });
          else if (operation === "searchFromUrl") result = await unipileMethod.call(this, "POST", accountId, "/linkedin/recruiter/search", { url: str("searchUrl", index) });
          else result = await unipileMethod.call(this, "POST", accountId, "/linkedin/recruiter/search/parameters", compact({ source: "SEARCH", type: str("parameterType", index), keywords: str("parameterQuery", index) }));
        } else if (resource === "messaging") {
          if (operation === "listChats") result = await unipileMethod.call(this, "GET", accountId, "/chats", undefined, { limit: this.getNodeParameter("limit", index, 50) });
          else if (operation === "getChat") result = await unipileMethod.call(this, "GET", accountId, `/chats/${encodeURIComponent(str("chatId", index))}`);
          else if (operation === "listMessages") result = await unipileMethod.call(this, "GET", accountId, `/chats/${encodeURIComponent(str("chatId", index))}/messages`);
          else if (operation === "sendMessage") result = await unipileMethod.call(this, "POST", accountId, `/chats/${encodeURIComponent(str("chatId", index))}/messages/send`, { text: str("text", index) });
          else if (operation === "startChat") result = await unipileMethod.call(this, "POST", accountId, "/chats/send", { attendees_ids: ids(str("usersIds", index)), text: str("text", index) });
          else if (operation === "forwardMessage") result = await unipileMethod.call(this, "POST", accountId, `/chats/${encodeURIComponent(str("chatId", index))}/messages/${encodeURIComponent(str("messageId", index))}/forward`, { chat_id: str("targetChatId", index) });
          else result = await unipileMethod.call(this, "POST", accountId, `/chats/${encodeURIComponent(str("chatId", index))}/messages/${encodeURIComponent(str("messageId", index))}/reactions`, { reaction: str("reaction", index) });
        } else if (resource === "email") {
          if (operation === "list") result = await unipileMethod.call(this, "GET", accountId, "/emails", undefined, { limit: this.getNodeParameter("limit", index, 20) });
          else if (operation === "listFolderEmails") result = await unipileMethod.call(this, "GET", accountId, `/folders/${encodeURIComponent(str("folderId", index))}/emails`, undefined, { limit: this.getNodeParameter("limit", index, 20) });
          else if (operation === "listFolders") result = await unipileMethod.call(this, "GET", accountId, "/folders");
          else if (operation === "get") result = await unipileMethod.call(this, "GET", accountId, `/emails/${encodeURIComponent(str("emailId", index))}`);
          else if (operation === "markRead") result = await unipileMethod.call(this, "POST", accountId, `/emails/${encodeURIComponent(str("emailId", index))}/read`);
          else if (operation === "markUnread") result = await unipileMethod.call(this, "POST", accountId, `/emails/${encodeURIComponent(str("emailId", index))}/unread`);
          else result = await unipileMethod.call(this, "POST", accountId, "/emails/send", compact({ to: addresses(str("to", index)), cc: addresses(str("cc", index)), bcc: addresses(str("bcc", index)), subject: str("subject", index), plain_text: str("plainText", index), html: str("html", index), reply_to_message_id: str("replyToMessageId", index) }));
        } else if (resource === "calendar") {
          if (operation === "listCalendars") result = await unipileMethod.call(this, "GET", accountId, "/calendars");
          else if (operation === "getCalendar") result = await unipileMethod.call(this, "GET", accountId, `/calendars/${encodeURIComponent(str("calendarId", index))}`);
          else if (operation === "listEvents") result = await unipileMethod.call(this, "GET", accountId, `/calendars/${encodeURIComponent(str("calendarId", index))}/events`, undefined, compact({ start: str("start", index), end: str("end", index) }));
          else if (operation === "createEvent") result = await unipileMethod.call(this, "POST", accountId, `/calendars/${encodeURIComponent(str("calendarId", index))}/events`, { title: str("title", index), start: str("eventStart", index), end: str("eventEnd", index), attendees: ids(str("attendees", index)).map((email) => ({ email })), ...parseJson.call(this, this.getNodeParameter("eventFields", index, "{}"), "Fields") });
          else if (operation === "updateEvent") result = await unipileMethod.call(this, "PATCH", accountId, `/calendars/${encodeURIComponent(str("calendarId", index))}/events/${encodeURIComponent(str("eventId", index))}`, parseJson.call(this, this.getNodeParameter("eventFields", index, "{}"), "Fields"));
          else if (operation === "deleteEvent") result = await unipileMethod.call(this, "DELETE", accountId, `/calendars/${encodeURIComponent(str("calendarId", index))}/events/${encodeURIComponent(str("eventId", index))}`);
          else result = await unipileMethod.call(this, "POST", accountId, `/calendars/${encodeURIComponent(str("calendarId", index))}/events/${encodeURIComponent(str("eventId", index))}/rsvp`, { status: str("rsvpStatus", index) || "yes" });
        } else if (resource === "post") {
          if (operation === "create") result = await unipileMethod.call(this, "POST", accountId, "/posts", { text: str("text", index) });
          else if (operation === "get") result = await unipileMethod.call(this, "GET", accountId, `/posts/${encodeURIComponent(str("postId", index))}`);
          else if (operation === "comment") result = await unipileMethod.call(this, "POST", accountId, `/posts/${encodeURIComponent(str("postId", index))}/comments`, { text: str("text", index) });
          else if (operation === "listComments") result = await unipileMethod.call(this, "GET", accountId, `/posts/${encodeURIComponent(str("postId", index))}/comments`);
          else result = await unipileMethod.call(this, "POST", accountId, `/posts/${encodeURIComponent(str("postId", index))}/reactions`, { reaction: str("reaction", index) });
        } else {
          result = await unipileAnyEndpoint.call(
            this,
            this.getNodeParameter("anyMethod", index, "GET") as any,
            str("anyPath", index),
            parseJson.call(this, this.getNodeParameter("anyBody", index, "{}"), "Body"),
            parseJson.call(this, this.getNodeParameter("anyQuery", index, "{}"), "Query"),
          );
        }

        if (Array.isArray(result)) for (const entry of result as IDataObject[]) output.push({ json: entry, pairedItem: { item: index } });
        else output.push({ json: result as IDataObject, pairedItem: { item: index } });
      } catch (error) {
        if (this.continueOnFail()) {
          output.push({ json: { error: (error as Error).message }, pairedItem: { item: index } });
          continue;
        }
        throw new NodeOperationError(this.getNode(), error as Error, { itemIndex: index });
      }
    }
    return [output];
  }
}
