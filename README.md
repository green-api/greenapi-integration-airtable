# [GREEN-API](https://green-api.com/en) Integration with [Airtable](https://airtable.com)

Send WhatsApp, Telegram and MAX messages from an Airtable base and receive replies back into it, through
the [GREEN-API](https://green-api.com/en) platform. Built on
the [Universal Integration Platform](https://github.com/green-api/greenapi-integration) by GREEN-API.

The integration has two parts, kept in this repository:

- `extension/` — an Airtable extension (Blocks SDK) that base collaborators open inside Airtable. It holds the
  field mapping, previews messages and sends them.
- `src/` — a NestJS adapter service. It keeps GREEN-API instance credentials, sends messages, receives webhooks
  and writes incoming messages and delivery statuses into the base through the Airtable Web API.

Nothing secret is stored in the base: instance tokens live only in the adapter, and every collaborator confirms their
identity with their own Airtable account before they can send.

## Table of contents

- [How it works](#how-it-works)
- [Who can do what](#who-can-do-what)
- [Message types and limits](#message-types-and-limits)
- [Recipients: phones and chat ids](#recipients-phones-and-chat-ids)
- [Receiving messages](#receiving-messages)
- [Tools: check numbers, history, contacts, QR](#tools-check-numbers-history-contacts-qr)
- [Automations and other HTTP clients](#automations-and-other-http-clients)
- [Running the adapter](#running-the-adapter)
- [Registering the Airtable OAuth integration](#registering-the-airtable-oauth-integration)
- [Running and releasing the extension](#running-and-releasing-the-extension)
- [Self-hosting checklist](#self-hosting-checklist)
- [Adapter API](#adapter-api)
- [What the adapter stores](#what-the-adapter-stores)
- [Development](#development)

## How it works

```
Airtable base ──(extension UI)──▶ adapter ──▶ GREEN-API ──▶ WhatsApp / Telegram / MAX
      ▲                              │
      └──(Airtable Web API, OAuth)───┘◀── webhooks (messages, statuses) ◀── GREEN-API
```

1. A base owner installs the extension and points it at the adapter URL (Settings → Advanced).
2. Every collaborator confirms their identity once per browser through Airtable OAuth. The adapter checks their
   role in the base and issues them a personal key that the extension keeps in the browser's local storage.
3. An owner adds GREEN-API instances (`idInstance`, `apiTokenInstance`, `apiUrl` from the GREEN-API console; only
   GREEN-API hosts are accepted). The adapter verifies them and detects the messenger (WhatsApp, Telegram or MAX).
4. Sending: the collaborator maps a table, a phone column and a message; selects rows (or a whole view) and presses
   Send. The extension builds one payload per row and hands the batch to the adapter, which sends them through
   GREEN-API and reports per-row results back (status, message id, timestamp columns).
5. Receiving: the owner grants the adapter Airtable access for the base and switches receiving on for an instance.
   The adapter sets the instance webhook to itself; every incoming and outgoing message becomes a row in a
   *Messages* table, and delivery / read statuses update those rows and the status column of the sending table.

## Who can do what

Roles come from Airtable itself (the collaborator's permission level in the base), confirmed through OAuth.

| Airtable role      | Confirm identity | Send | Add / remove instances, receiving, people | Which instances |
|--------------------|------------------|------|-------------------------------------------|-----------------|
| Owner / Creator    | yes              | yes  | yes                                       | every instance of the base |
| Editor             | yes              | yes  | no                                        | only the instances an owner ticked for them (Settings → People) |
| Commenter / Reader | refused          | no   | no                                        | — |

The instance used for sending is chosen in the panel header; the choice is remembered per browser. Owners can also
revoke a person's key (they will have to confirm identity again) or remove them entirely.

## Message types and limits

| Type         | Content sources                                                     | WhatsApp | Telegram | MAX |
|--------------|---------------------------------------------------------------------|----------|----------|-----|
| Text         | a field, or a template with `{Field name}` placeholders             | 20 000 chars | 4 096 chars | 4 000 chars |
| File         | an attachment field (first file), a URL field, or a fixed URL       | yes | yes | yes |
| Location     | latitude / longitude / name / address — fields or fixed values      | yes | yes | yes |
| Contact card | phone / first name / last name / company — fields or fixed values   | yes | yes | yes |
| Poll         | question (field or template) + 2–12 fixed options                   | yes | groups only | yes |
| Buttons      | header / body / footer + up to 3 reply **or** URL / call / copy buttons | yes | — | — |

Rows that cannot be sent (no phone, text over the limit, buttons on a Telegram instance, a poll to a personal Telegram chat, …) are shown greyed out
in the preview with the reason and skipped; the rest of the batch goes out.

Other limits: up to 5 000 rows per send; files up to 100 MB; the adapter does not pace sends — GREEN-API's own per-instance queue does
(`delaySendMessagesMilliseconds` in the instance settings).

## Recipients: phones and chat ids

The mapped "phone" column can be any text, phone, formula or lookup field.

- **WhatsApp**: any phone format works (`+1 (212) 555-0123`, `12125550123`, …) — digits are kept and `@c.us` is
  appended. Group ids (`…@g.us`) are passed through.
- **Telegram / MAX**: GREEN-API addresses chats by id. A value of **digits only** is treated as a chat id (that is
  what the `Chat ID` column of received messages contains); a value starting with `-` is a group id; anything
  formatted like a phone (`+…`, spaces, brackets) is normalised to `<digits>@c.us` and delivered by phone number.
  Keep chat ids in a single line text column — Airtable's phone number type reformats bare digits.

## Receiving messages

Settings → Receiving:

1. **Grant access** — Airtable OAuth for the base with `data.records:read/write` and `schema.bases:read`. An
   owner's first identity confirmation already includes this, so usually nothing to do.
2. **Instances that forward to this base** — the switch calls `setSettings` on the instance with
   `webhookUrl = <APP_URL>/api/v1/webhooks/green-api` and a random `webhookUrlToken`. An instance can only have
   one webhook URL, so anything it pointed at before stops receiving. Switching it off clears the webhook again.
3. **Messages table** — pick a table or press *Create table* to get one with all columns pre-mapped:
   Message ID, Direction, Chat ID, Sender name, Contact (link), Type, Text, Attachments, Timestamp, Status,
   Instance, Quoted message ID, Location (map link), Details (JSON). *Message ID* must be mapped — it is how
   delivery statuses find their row and how re-delivered messages are recognised; the rest may be any subset.
4. **Link messages to contacts** — optional: pick the contacts table, its phone column and (for Telegram / MAX) a
   chat id column; each message row is linked to the contact whose phone or chat id matches. Telegram and MAX
   identify people by chat id, so without that column their messages link only when the messenger knows the
   sender's phone. *Tools → Check numbers* fills the column.

The adapter writes each webhook into Airtable synchronously and answers GREEN-API with `200`. If the write fails
(Airtable rate limit, expired token, deleted column, outage), it answers `503`, and GREEN-API re-delivers the same
webhook every minute for up to 24 hours. A re-delivered message that was already written is recognised by its
`idMessage` and not duplicated.

Statuses (`sent → delivered → read`, or `failed`) update both the Messages table and, when mapped, the status column
of the table the message was sent from.

## Tools: check numbers, history, contacts, QR

| Where | What | GREEN-API method |
|---|---|---|
| Tools → *Check numbers* | Asks the messenger whether each selected phone has an account and writes yes/no into the mapped column (Sending → *Columns the extension fills in*). On Telegram / MAX the resolved chat id is also written into the *Chat ID* column and used for linking and as the recipient later. | `checkWhatsapp` / `checkAccount` |
| Tools → *Chat history* (one row selected) | Imports the last 100 messages of that chat into the messages table. On Telegram / MAX a phone number is first resolved to the chat id, because their journals are keyed by chat id. | `checkAccount`, `getChatHistory` |
| Tools → *Import history* | Imports the messenger's journal for the chosen period (last hour up to all time) into the messages table — what happened before receiving was switched on. Messages already in the table are skipped. | `lastIncomingMessages`, `lastOutgoingMessages` |
| Tools → *Import contacts* | Copies the messenger's address book (name, phone, chat id) into a table, skipping contacts already present. Telegram / MAX contacts that hide their phone are imported by chat id when a chat id column is mapped. | `getContacts` |
| Instances → *Link phone* (instance not authorized) | Shows the QR code in the panel and refreshes it until the instance is linked. | `qr` |
| Send tab, after a send | Shows how many messages are still waiting in GREEN-API's queue for the instance, with a button to clear it. | `showMessagesQueue`, `clearMessagesQueue` |

Files are sent by upload: the adapter downloads the attachment when it reaches the row and uploads the bytes
(`sendFileByUpload`), so the Airtable link only has to be valid at that moment, not when GREEN-API's queue gets to it.

## Automations and other HTTP clients

Sending does not require the panel to be open. A base owner creates an **automation key** in Tools → Automations
(name it, optionally pin it to one instance; it is shown once and can be revoked any time). The key can send and
nothing else.

`POST <APP_URL>/api/v1/send` with `Authorization: Bearer ak_…`:

```json
{
  "idInstance": 1101000001,
  "phone": "+1 212 555 0123",
  "payload": {"type": "text", "text": "Your order is ready"},
  "recordId": "recXXXXXXXXXXXXXX",
  "writeBack": {"tableId": "tblXXXXXXXXXXXXXX", "statusFieldId": "fldXXXXXXXXXXXXXX", "statusFieldType": "singleSelect"}
}
```

`payload` is one of:

| `type`     | fields |
|------------|--------|
| `text`     | `text` |
| `file`     | `url` (public link), `fileName` (with extension), `caption?` |
| `location` | `latitude`, `longitude` (numbers), `name?`, `address?` |
| `contact`  | `phone`, `firstName?`, `middleName?`, `lastName?`, `company?` |
| `poll`     | `question`, `options` (2–12 strings), `multipleAnswers?` |
| `buttons`  | `body`, `header?`, `footer?`, `buttons` (≤3 of `{type: "reply" \| "url" \| "call" \| "copy", text, value?}`; reply buttons cannot be mixed with the others; WhatsApp only) |

Tools → Automations generates a ready script for each type. `recordId` and `writeBack` are optional; with them, delivery and read statuses land in that record's status column
like panel sends. The call waits up to 25 s for GREEN-API to accept the message and returns

```json
{"jobId": "…", "status": "sent", "chatId": "12125550123@c.us", "idMessage": "3EB0…", "error": null}
```

`status` is `failed` (with `error`) when the row was rejected, or `queued` if the instance did not answer in time
(the message is still in the queue; the job can be checked in the panel).

For an Airtable Automation: *Run script* action, input variables `phone`, `message`, `recordId` from the trigger
record, and the script that Tools → Automations shows (pre-filled with this base's table and status column):

```js
const {phone, message, recordId} = input.config();
const response = await fetch('https://airtable.int.green-api.com/api/v1/send', {
    method: 'POST',
    headers: {'Authorization': 'Bearer ak_…', 'Content-Type': 'application/json'},
    body: JSON.stringify({idInstance: 1101000001, phone, recordId, payload: {type: 'text', text: message}}),
});
const result = await response.json();
if (!response.ok || result.status === 'failed') {
    throw new Error(result.error ?? result.message ?? response.statusText);
}
output.set('idMessage', result.idMessage);
```

The same endpoint works from Interface "Run script" buttons, Make, Zapier, n8n or anything else that can do HTTP.

## Running the adapter

Requirements: Node.js 24, MySQL 8 (or MariaDB), a public HTTPS URL for the adapter (webhooks and OAuth callbacks
must reach it).

```bash
npm ci
cp .env.example .env        # fill in the values below
npx prisma migrate deploy
npm run build
npm run start:prod
```

`.env`:

| Variable                | Meaning |
|-------------------------|---------|
| `DATABASE_URL`          | MySQL connection string, e.g. `mysql://user:pass@host:3306/adapter` |
| `APP_URL`               | public base URL of the adapter, e.g. `https://airtable.int.green-api.com`. Used to build the OAuth redirect (`/api/v1/oauth/callback`) and the webhook URL (`/api/v1/webhooks/green-api`) |
| `PORT`                  | listen port, default `3000` |
| `AIRTABLE_CLIENT_ID`    | from the Airtable OAuth integration (below) |
| `AIRTABLE_CLIENT_SECRET`| from the same integration; required, the adapter refuses to start without it |

All variables are validated at startup. With Docker: `docker compose up --build` (runs migrations, then the app).

## Registering the Airtable OAuth integration

At [airtable.com/create/oauth](https://airtable.com/create/oauth):

1. Name and register the integration.
2. **Generate a client secret** — the token exchange is done by the adapter (a server), so Airtable requires it.
   Copy it once into `.env`.
3. **OAuth redirect URL**: `<APP_URL>/api/v1/oauth/callback`.
4. Scopes — exactly these four:

| Scope                 | Used for |
|-----------------------|----------|
| `user.email:read`     | identifying the collaborator when they confirm identity |
| `schema.bases:read`   | reading their role in the base, and the table/field names for receiving |
| `data.records:read`   | finding the contact to link an incoming message to |
| `data.records:write`  | writing message rows and statuses |

PKCE is always used (Airtable requires it); the client secret is sent as HTTP Basic auth on the token and refresh
requests. Access tokens live 60 minutes and are refreshed by the adapter; refresh tokens live 60 days and are renewed
whenever used.

## Running and releasing the extension

`extension/` is a standard Blocks SDK project. The CLI is run through `npx` with a pinned version, so nothing is
installed globally.

```bash
cd extension
npm ci
npm start          # dev server on https://localhost:9000
```

First time only: in the base, *Extensions → Add an extension → Build an extension*. The dialog shows the base and
extension ids; register them as this project's remote (the project is already initialised, do not run `block init`):

```bash
npx --yes @airtable/blocks-cli@3.0.3 add-remote appXXXXXXXXXXXXXX/blkXXXXXXXXXXXXXX dev
npm start
```

Then paste the dev URL (`https://localhost:9000`) into the dialog. The panel loads from your machine and rebuilds on
every edit. `.block/remote.json` is per developer and git-ignored.

Point the extension at your adapter in Settings → Advanced (default: `https://airtable.int.green-api.com`,
`DEFAULT_ADAPTER_URL` in `extension/frontend/defaults.ts`).

To publish:

```bash
npm run release    # block release — pushes the build to the extension in the base
npm run submit     # block submit — Marketplace review
```

Custom extensions (and the Marketplace) require a paid Airtable plan. A custom extension lives in one base; to use
it in another base, add that base as another remote (`block add-remote`) and release again.

## Self-hosting checklist

1. Deploy the adapter on a public HTTPS domain with a MySQL database (`docker compose` or any Node host).
2. Register your own Airtable OAuth integration with the redirect URL of that domain; put client id and secret
   into `.env`.
3. In your base, create a custom extension and `block release` this `extension/` into it.
4. Open the extension: Settings → Advanced → adapter URL = your domain. Confirm identity, add instances.

## Adapter API

All routes are under `/api/v1`. Every route except `oauth/*` and `webhooks/*` needs `Authorization: Bearer pk_…`
(a personal key). Rate limits: 300 requests/min per IP; `oauth/identity` 10/min.

| Method | Route                          | Who   | Purpose |
|--------|--------------------------------|-------|---------|
| POST   | `oauth/identity`               | anyone | start identity confirmation for a base → authorization URL |
| POST   | `oauth/claim`                  | anyone | exchange the completed authorization for the personal key |
| GET    | `oauth/callback`               | Airtable | OAuth redirect target |
| POST   | `oauth/base`                   | owner | (re)grant the adapter Airtable access for the base |
| GET    | `bases/me`                     | member | base view: Airtable connection, receiving config, instances, the caller |
| PUT / DELETE | `bases/inbound`           | owner | set / clear the receiving configuration |
| DELETE | `bases/airtable`               | owner | disconnect the base's Airtable access |
| GET    | `instances`                    | member | instances with live state and phone |
| POST   | `instances`                    | owner | add an instance (`idInstance`, `apiTokenInstance`, `apiUrl`, `name?`) |
| PATCH  | `instances/:id/receive`        | owner | switch receiving on/off |
| DELETE | `instances/:id`                | owner | remove an instance (clears its webhook first) |
| GET    | `users/me`, `users`            | member / owner | the caller; everyone who confirmed identity |
| PUT    | `users/:id/instances`          | owner | which instances an editor may use |
| POST   | `users/:id/revoke`, DELETE `users/:id` | owner | revoke a key / remove a person |
| POST   | `jobs`                         | member | send a batch (`idInstance`, `items[]`, `writeBack?`) |
| GET    | `jobs`, `jobs/:id`             | member | recent jobs; one job with per-row results |
| POST   | `jobs/:id/cancel`              | member | stop a running job |
| GET / POST | `automation-keys`          | owner | list / create automation keys (the key itself is returned once) |
| DELETE | `automation-keys/:id`          | owner | revoke a key |
| POST   | `instances/:id/check`          | member | check phones on the instance's messenger |
| POST   | `instances/:id/history`, `instances/:id/chat-history` | member | import the journal / one chat into the messages table |
| GET    | `instances/:id/queue`, POST `instances/:id/queue/clear` | member | GREEN-API queue size; clear it |
| GET    | `instances/:id/qr`             | member | QR code for linking |
| GET    | `instances/:id/contacts`       | member | the messenger's address book |
| POST   | `send`                         | automation key | send one message; waits for the result (see above) |
| POST   | `webhooks/green-api`           | GREEN-API | webhook receiver (Bearer `webhookUrlToken`) |

## What the adapter stores

Message content is not kept. The database holds:

- the base id and its receiving configuration, and the base's Airtable OAuth tokens;
- people who confirmed identity (Airtable user id, email, name, role, a hash of their personal key) and which
  instances editors may use;
- instances (`idInstance`, `apiTokenInstance`, `apiUrl`, messenger, state, webhook settings);
- automation keys (name, instance restriction, a hash of the key, when last used);
- send jobs: one row per batch and per recipient with status, GREEN-API message id and error. The message payload
  is kept only while the row is queued and removed as soon as it is sent or fails;

Incoming webhooks are written straight into Airtable and not stored; GREEN-API's own queue is the retry buffer.

Note that the `greenapi-integration` library logs request bodies and webhooks at `info` level, so message text and
phone numbers do appear in the adapter's stdout unless log output is filtered.

## Development

```bash
npm test                         # adapter unit tests (jest)
cd extension && npm test         # extension unit tests
```

- Adapter: NestJS 11, Prisma 7 (`prisma/schema.prisma`, one squashed `init` migration while unreleased),
  `src/defaults.ts` for every constant, `src/errors.ts` for error codes.
- Extension: React 16 + Blocks SDK 1.19, config stored in `globalConfig` under `greenapi` (`extension/frontend/config`),
  message building in `extension/frontend/send/compose.ts`, styling tokens in `extension/frontend/style.css`.
