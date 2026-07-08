# Encore Deployment Flow

This repo can deploy through Encore Cloud from GitHub once the Encore app is connected to the GitHub repository and configured to watch the `main` branch.

The frontend deploys separately through Vercel, which is linked to the GitHub repo.

## What actually happens

1. You change code locally.
2. You verify it with tests and lint.
3. You commit the change.
4. You push the commit to GitHub on `main`.
5. Encore Cloud receives the GitHub update for the connected repo and starts deploys for the linked app.
6. The app currently linked here is `ideal-stay-online-gh5i`.
7. Encore creates environment deploy records for both `staging` and `prod`.
8. You verify the deploy in the Encore Cloud dashboard.

## Frontend deployment

The frontend is deployed by Vercel from GitHub, not by the Encore remote.

The repo contains a Vercel project config in:

- [`.vercel/project.json`](../.vercel/project.json)
- [`vercel.json`](../vercel.json)

That means a GitHub push can trigger the frontend deployment pipeline through Vercel if the project is connected that way in the dashboard.

In practice:

- `git push origin main` updates GitHub
- Encore Cloud can be configured to deploy from that GitHub branch
- Vercel can then deploy the frontend from the GitHub-connected repo

If the Vercel project is set to auto-deploy from the GitHub `main` branch, then yes, the frontend part works off GitHub commits.
That is separate from the Encore backend deploy path.

## What the remote means

This repo has a dedicated remote named `encore`:

```text
encore://ideal-stay-online-gh5i
```

That remote is a direct deploy trigger used when pushing locally to Encore.
If GitHub is configured as the source of truth for the app, the GitHub push becomes the deploy trigger instead.

## What MCP is for

Encore MCP is useful for context and cloud inspection.

It helps with:

- understanding app services and endpoints
- inspecting deployment metadata
- checking infrastructure state
- querying the deployed app context

It is not the same thing as the deployment trigger in this repo.

The local MCP server can be started with:

```bash
encore mcp start --app ideal-stay-online-gh5i
```

That exposes a local SSE endpoint for MCP-aware tools.

## Current app

- App id: `ideal-stay-online-gh5i`
- Linked local remote: `encore://ideal-stay-online-gh5i`
- Staging environment: `staging`
- Production environment: `prod`
- Vercel project: `ideal-stay`

## Operational sequence used here

The clean release loop is:

1. `npm run lint`
2. `npm test`
3. `git commit -m "..."`
4. `git push origin main`
5. Confirm Encore Cloud is connected to the GitHub repo and watching `main`
6. Check both Vercel and Encore Cloud deploy status
7. Run live smoke against the deployed frontend if the change touches the public flow

## Notes

- Pushing to `origin` updates GitHub.
- Pushing to `origin` can trigger Vercel if the project is GitHub-connected.
- Encore Cloud can also be configured to trigger from GitHub directly.
- The local Encore CLI in this environment does not expose a working `encore deploy` subcommand.
- For this repo, the deployment source of truth should be GitHub once the Encore app connection is enabled.

Author: (|/) Klaasvaakie
