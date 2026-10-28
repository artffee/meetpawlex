# PawLex production deployment

## Source of truth

On 2026-10-28, meetpawlex.com was served by Vercel project `pawlex`
(`prj_IZajiAgKdj5TbemOknthfpAYm0F2`, team `team_h9a6UAtdfEyOIHcS9zYtSfOm`).
Its production deployment was uploaded via CLI, not from this repository.
The root HTML/JS/CSS files in this repository are an older site and must not
be deployed over the current site.

`production/` contains the reviewed changes to the CURRENT live site.
`baseline-files.json` records the content hashes of unchanged deployed pages,
assets and the existing scanner function. `scripts/deployment-payload.mjs`
combines those files with the production overrides. This preserves every
customer-facing page and the scanner without inventing or replacing missing
scanner source. Development logs, old screenshots and internal notes from the
old upload are excluded from the deployed static files.

The provider's source retrieval tool truncates large files, so this repository
is deliberately an overlay, not a claim of a complete recovered source tree.
Keep the baseline deployment until its original full source has been recovered.
Do not enable automatic Git deployment from the root directory.

## Validate and deploy

1. `npm ci --prefix production --ignore-scripts`
2. `npm test`
3. Install the pinned Playwright dev dependency (`npm install --ignore-scripts`),
   then `npx playwright install chromium` and `npm run test:browser`.
4. Commit the reviewed changes before building a payload.
5. `npm run deployment:prepare` writes ignored `deployment/payload.json`.
6. Use Vercel's create-deployment API with this payload, scoped to the team above,
   for a protected preview. Or with an authenticated Vercel CLI:
   `vercel api /v13/deployments --method POST --input deployment/payload.json --teamId team_h9a6UAtdfEyOIHcS9zYtSfOm`
7. Verify the preview using a short-lived deployment-specific share link.
8. Create the same release with `target: production` after verification. The
   existing CLI/API workflow assigns the project's production domains.
9. Confirm the live form and `/api/waitlist` again. Revert with Vercel's rollback
   operation to the previous deployment if needed (old release has no working
   signup; do not leave that fallback running without disabling its fake form).

Never commit environment files, API credentials, share-link tokens, applicant
records, or deployment payloads. The payload contains source code but no secrets.
