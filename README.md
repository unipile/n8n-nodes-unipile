# @unipile/n8n-nodes-unipile

Official n8n community node for [Unipile](https://developer.unipile.com): LinkedIn (Classic, Sales Navigator, Recruiter), WhatsApp, Instagram, Telegram, Gmail/Outlook/IMAP and Google/Outlook Calendar, without an agent in the loop.

This is the maintained, officially supported node under the `unipile` GitHub org. If you were using the third-party `n8n-nodes-unipile` package (a separate, unaffiliated community project), this one covers the same ground plus the LinkedIn product distinctions below, and is the one linked from [unipile.com](https://www.unipile.com/mcp).

## Install

Community Nodes install guide: https://docs.n8n.io/integrations/community-nodes/installation/

In n8n: **Settings → Community Nodes → Install**, package name `@unipile/n8n-nodes-unipile`.

## Credentials

Add a **Unipile API** credential:

- **API Key** — a scoped Account API key from your Unipile dashboard.
- **DSN (Base URL)** — your Unipile tenant's DSN, protocol and port included (e.g. `https://api1.unipile.com:13111`). It is specific to your account; there is no shared default.

Requests are authenticated with `X-API-KEY`. The credential test calls `GET {DSN}/v2/accounts`.

## Resources and operations

- **Account** — List Accounts, Get Account.
- **LinkedIn Classic** — Get Profile, Search People/Companies/Jobs/Posts, Get Search Parameters (resolve a human filter like a location or company name to the provider ID search expects), Get Company Profile, Send/List/Accept Invitation, List My Relations, Get InMail Credits, List Contracts.
- **LinkedIn Sales Navigator** — Search People (lead search on a Sales Navigator seat), Search From URL (paste a Sales Navigator results URL), Get Search Parameters.
- **LinkedIn Recruiter** — Search Candidates (talent search on a Recruiter contract), Search From URL, Get Search Parameters.
- **Messaging** (WhatsApp, Instagram, Telegram and LinkedIn share the same routes) — List Chats, Get Chat, List Messages, Send Message, Start Chat, Forward Message, Add Reaction.
- **Email** (Gmail, Outlook, any IMAP mailbox) — List Emails, List Folder Emails, Get Email, Send Email, Mark as Read/Unread, List Folders.
- **Calendar** (Google, Outlook) — List Calendars, Get Calendar, List Events, Create/Update/Delete Event, RSVP Event.
- **Post** — Create Post, Get Post, Comment Post, List Comments, Add Reaction.
- **Any Endpoint** — method + path + query + body passthrough, for anything not covered above yet (job postings, Recruiter applicants/resumes, hiring projects…). Same request either way: whether you run it from this node or call it directly from your own code, it's the same Unipile V2 endpoint.

Every operation other than Account takes an **Account ID** (`unipile_account_id` from List Accounts) — Unipile never guesses which connected account a call runs on.

## Example: LinkedIn Recruiter search wired to a Slack digest

1. **Unipile → LinkedIn Recruiter → Search Candidates**, with keywords and a resolved location/seniority filter from **Get Search Parameters**.
2. **Unipile → LinkedIn Classic → Get Profile** on each result needing enrichment.
3. Format and send to **Slack**.

## Compatibility

- `n8n-workflow` peer dependency, n8n Nodes API version 1.
- Node.js ≥ 18.10.

## Resources

- Unipile MCP (for building the integration itself from a coding agent): https://github.com/unipile/unipile-mcp
- Official SDKs: [Node.js/TypeScript](https://github.com/unipile/unipile-node-sdk), [Python](https://github.com/unipile/unipile-python)
- n8n community nodes docs: https://docs.n8n.io/integrations/#community-nodes

## License

MIT
