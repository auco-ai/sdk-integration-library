# Changelog - sdk-integration-library

## [1.2.0] - 25-11-2026

Thanks to Pedro Lobato (@Lob26) for the audit in issue #19 that guided most of these fixes.

## Added
- `env: 'INTERNAL'` to reach Auco's internal dev environment (Auco team only)
- Optional `events.onSDKError(error)`: receives errors raised while handling SDK messages (a missing `onSDKToken`/`onSDKPay`, or an error thrown by your callbacks). Without it, errors are logged with `console.error` instead of becoming unhandled promise rejections
- Public types (`Config`, `SDKEvents`, `EnvType`, `UxOptions`, `LANGUAGES`, ...) are exported from the package entry: `import type { Config } from 'auco-sdk-integration'`

## Fixed
- `env: 'DEV'` always resolves to the stage environment. Since 1.0.8, integrators without `keyPublic` (e.g. `sign`, as in the docs example) were sent to the internal `*-dev` hosts, which they cannot reach. Auco internal apps must switch from `'DEV'` to `'INTERNAL'`
- Two iframes of the same SDK origin (two `sign`, or `upload` + `read`) no longer receive each other's messages: messages must come from the configured iframe
- Starting the SDK again on the same iframe replaces the previous session instead of adding a second listener
- A `customOrigin` with a trailing slash or path no longer drops every message; a `customOrigin` that is not an http(s) URL or an unknown `sdkType` now throws on start
- SDKs that ask for a token without `keyPublic` (upload family, `upload-v2`, `validation`, and `sign` with `email`) throw on start when `onSDKToken` is missing, instead of leaving the iframe waiting
- Token requests are matched by `type: 'token'` exactly
- Removed `String.prototype.replaceAll` from the runtime (not available in older browsers)

## Changed
- `onSDKNotification` options are typed as `{ tag?: string }` instead of the DOM `NotificationOptions` type

## Deprecated
- `keyPrivate`: it is never sent to the SDK. Do not put private keys in browser code. It will be removed in 2.0.0
- `sdkType: 'list-validation'`: it is no longer available and now throws on start. It will be removed in 2.0.0

## [1.1.0] - 06-10-2026

## Added
- `language` now accepts Portuguese (`'pt'`) and French (`'fr'`) besides `'es'` and `'en'`

## [1.0.9] - 08-09-2026

## Added
- Production and stage URLs for `upload-v2`

## [1.0.8] - 18-08-2026

## Added
- New sdk-upload-v2 (BETA)
- Added support for dev environment (Auco internal use only)

## Changes
- Started tracking changes 