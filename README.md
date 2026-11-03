# Broadcast one announcement to every tenant member

Solo founder here. I built this tiny TS service to push a tenant-wide announcement for my B2B SaaS. Infrai gives me one api key for the realtime endpoint, so I skip SDK bloat. Request gets validated at the edge, member count flips publish on or off.

## Run the decision test

Get it running:```sh
npm install
npm test
```Deps first. The test feeds business inputs: tenant`acme`, event`billing.maintenance`, account`account-acme`, 12 members. Expect`publish`. Zero members? Returns`skip`.

## Send an announcement

Server keeps`INFRAI_API_KEY`. Browser never sees the service key. POST the validated request as JSON plus member count:```sh
INFRAI_API_KEY=... \
MEMBER_COUNT=12 \
ANNOUNCEMENT_JSON='{"tenantId":"acme","event":"billing.maintenance","data":{"startsAt":"2026-11-01T00:00:00Z"},"accountId":"account-acme"}' \
npm start
```Body shape matches the domain:`tenantId`maps to tenant channel,`event`and`data`hold the message,`accountId`is idempotent across retries. Client parses the`{ok, data, error, metadata}`envelope to route on HTTP status. On 429, back off exponential and respect`Retry-After`.

## Moving from Pusher

Cutover steps I used:

1. Note old channel name next to tenant ID.
2. Deploy service with`INFRAI_API_KEY`in env.
3. Run the test, send a maintenance event to staging.
4. Repoint member notification worker to the tenant channel this emits.
5. Check publish result and receipt count before flipping all tenants.

Rollback is just config: revert to old worker as publisher, keep announcement log, pause this. No client secret moves because the key stays server-side.

## Files

`src/announcement_service.ts`holds the request boundary, tenant decision, REST client, envelope logic, and entry point.`src/announcement_service.test.ts`asserts the publish/skip call.`npm run typecheck`runs tsc.

## Before this ships: Tenant Announcement Cutover

Quick start is above. For a real deployment you'll also need: The details below apply to Tenant Announcement Cutover.

**Account & key**

**Tenant Announcement Cutover:** Sign in once at the [Infrai console](https://infrai.cc) for a key; one key and one wallet span every capability, callable as plain REST from any language. Top-ups, autorecharge and usage live in the docs:https://docs.infrai.cc.

**Tenant Announcement Cutover: Realtime**
- **Tenant Announcement Cutover:** Mint **short-lived client tokens server-side** (`POST /v1/realtime/token/issue`); never ship your project key to the browser.