# Changelog - sdk-integration-library

## [Unreleased]

## Added
- `env: 'INTERNAL'` to reach Auco's internal dev environment (Auco team only)

## Fixed
- `env: 'DEV'` always resolves to the stage environment. Since 1.0.8, integrators without `keyPublic` (e.g. `sign`, as in the docs example) were sent to the internal `*-dev` hosts, which they cannot reach. Auco internal apps must switch from `'DEV'` to `'INTERNAL'`

## [1.1.0] - 06-10-2026

## Added
- `language` now accepts Portuguese (`'pt'`) and French (`'fr'`) besides `'es'` and `'en'`

## [1.0.8] - 18-08-2026

## Added
- New sdk-upload-v2 (BETA)
- Added support for dev environment (Auco internal use only)

## Changes
- Started tracking changes 