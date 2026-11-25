# Host ⇄ SDK protocol

How `auco-sdk-integration` (the **host**, your page) talks to an Auco SDK app loaded in an iframe (the **frame**) over `window.postMessage`. You only need this to debug an integration or to build your own wrapper; `AucoSDK(config)` implements the host side for you.

## Origins

The host loads `"<origin>?id=<timestamp>"` in the iframe and only accepts messages whose `event.origin` is that origin **and** whose `event.source` is that iframe's window.

| `sdkType` | `PROD` | `DEV` / `STAGE` |
|---|---|---|
| `sign` | `https://sign.auco.ai` | `https://sign-stage.auco.ai` |
| `upload`, `read`, `attachments`, `validation-attachments` | `https://upload.auco.ai` | `https://upload-stage.auco.ai` |
| `upload-v2` (beta) | `https://uploadv2.auco.ai` | `https://uploadv2-stage.auco.ai` |
| `validation` | `https://veriface.auco.ai` | `https://veriface-stage.auco.ai` |
| `fill` | `https://fill2.auco.ai` | `https://fill2-stage.auco.ai` |

Stage is a copy of production with a separate database: it is the development environment for integrators. `env: 'INTERNAL'` points at Auco's internal `*-dev` hosts and only works for the Auco team. `customOrigin` overrides all of the above.

## 1. Handshake

1. The frame loads and posts `{ ready: true }`.
2. The host answers with the init payload (below) and then calls `events.onSDKReady()`.

The frame can post `ready` again after internal navigation or a reload (for example `upload-v2` after `SDK-BACK`). While the host is still listening it answers every `ready` with the same payload and calls `onSDKReady` again.

### Init payload (host → frame)

```ts
{
  language: 'es' | 'en' | 'pt' | 'fr',
  ...sdkData,            // the per-SDK data from your config, spread at the top level
  keyPublic?: string,
  sdkParentURL: string,  // window.location.href of the host page
  flowType?: 'upload' | 'read' | 'attachments' | 'validation-attachments',
}
```

- `flowType` is only sent for the upload family (`upload`, `read`, `attachments`, `validation-attachments`) and equals `sdkType`.
- `sdkParentURL` is the full URL of the host page. `sign` encodes it in the QR code that lets a signer continue on their phone, so it must point at the page that renders the document.
- `keyPrivate` and `country` from the config are **not** sent.

## 2. Token (frame → host → frame)

When the frame needs the user's token it posts:

```ts
{ type: 'token' }
```

The host calls `events.onSDKToken()` and replies:

```ts
{ type: 'token', token: string }
```

Which SDKs ask for a token:

| SDK | When |
|---|---|
| `upload`, `read`, `attachments`, `validation-attachments`, `upload-v2` | No `keyPublic` |
| `validation` | No `keyPublic` |
| `sign` | A logged-in user (`sdkData.email` is set) |

`AucoSDK` throws on start if one of these cases has no `onSDKToken`.

## 3. Events (frame → host)

All events are `{ type, ...payload }`. Unknown types are ignored.

| `type` | Payload | Sent by | Host callback |
|---|---|---|---|
| `SDK-CLOSE` | see below | all | `onSDKClose(...)` |
| `SDK-FINISH` | none | `sign`, `upload-v2` | `onSDKFinish()` |
| `SDK-BACK` | none | `upload`, `upload-v2` | `onSDKBack()` |
| `SDK-PAY` | `data: { code, epaycoKey, validation, packageId? }` | `upload`, `upload-v2` | `onSDKPay(data)` (required if the flow can ask for payment) |
| `SDK-NOTIFICATION` | `data: { message, options: { tag } }` | `sign` (read flow, `tag: 'Abandoned'` when the reader leaves the tab) | `onSDKNotification(data)` |

### `SDK-CLOSE` payload

| SDK | Payload | `onSDKClose` arguments |
|---|---|---|
| `upload`, `read`, `attachments`, `validation-attachments` | `{ document, redirectTo: '', signProfile }` | `(document, redirectTo, signProfile)` |
| `upload-v2` | `{ document, redirectTo: '', signProfile }` (`document` is an object) | `(document, redirectTo, signProfile)` |
| `sign` | `{ redirectTo? }` | `('', redirectTo, [])` |
| `validation` with `keyPublic` | `{ similarity: number, status: 'SUCCESS' \| 'BLOCKED' }` | `(similarity, status, [])` |
| `validation` without `keyPublic` | `{ redirectTo? }` | `('', redirectTo, [])` |

The host maps the payload to positional arguments as `document ?? similarity ?? ''`, `redirectTo ?? status ?? ''`, `signProfile ?? []`.

## 4. When the host stops listening

| Message | Stops listening |
|---|---|
| `SDK-CLOSE` | Always, unless `status === 'PENDING'` |
| `SDK-FINISH` | Only if `onSDKFinish` is provided (`sign` sends `SDK-CLOSE` afterwards) |
| `SDK-BACK` | Only if `onSDKBack` is provided (`upload-v2` restarts and sends `ready` again) |
| `unsubscribe()` | Always |
| `AucoSDK()` again on the same iframe | The previous session stops |

The host does not reset the iframe when it stops listening.

## 5. Errors

Errors while handling a message (a missing `onSDKToken` or `onSDKPay`, or an error thrown by a callback) are passed to `events.onSDKError(error)`, or logged with `console.error` when it is not provided. Configuration errors (missing `iframeId`, invalid `language`, `keyPublic`, `customOrigin` or `sdkType`) are thrown synchronously by `AucoSDK()`.
