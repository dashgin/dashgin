---
name: dokploy
description: Manage Dokploy (list projects, deploy/redeploy/restart/stop services, read logs, create apps & domains) via its HTTP API using curl. Use THIS instead of the @dokploy/mcp server — the MCP injects 546 tool schemas into every model call (~500k tokens); this skill is ~1k tokens and loads only when needed.
metadata:
  tags: [devops, dokploy, deployment, infra]
---

# Dokploy management (via API, not MCP)

Control the Dokploy PaaS through its HTTP API with the terminal/`curl`. This
replaces the `@dokploy/mcp` server: same capabilities, ~100× less context cost,
because you call one generic tool (curl) instead of loading 546 typed tools.

> Why this exists: the Dokploy MCP exposes 546 tools. A naive agent loads all
> 546 schemas (~500k tokens) into every model call. This skill is ~700 tokens
> and only loads when you're actually managing Dokploy. See the write-up:
> "MCP Tool Bloat: Why 546 Tools Cost Me $1,557".

## Connection

- **Base URL:** `https://<YOUR_DOKPLOY_HOST>/api`
- **Auth:** header `x-api-key: $DOKPLOY_API_KEY` (store the key in an env var / `.env`, never hardcode)
- **Reads:** `GET /api/<router>.<procedure>?param=value`
- **Writes:** `POST /api/<router>.<procedure>` with a JSON body
- Endpoints are tRPC-style: `project.all`, `compose.deploy`, `application.redeploy`, etc.
- Responses are JSON. Pipe through `python3 -m json.tool` or `jq`.

Helper (paste once per shell):
```bash
DK() { local m=$1 p=$2; shift 2; curl -s -H "x-api-key: $DOKPLOY_API_KEY" \
  ${m:+-X $m} ${1:+-H "Content-Type: application/json" -d "$1"} \
  "https://$DOKPLOY_HOST/api/$p"; }
# reads:  DK "" project.all
# writes: DK POST compose.deploy '{"composeId":"..."}'
```

## Discover first (IDs are needed for everything)

```bash
# list projects + their services (composes/apps live inside environments)
curl -s -H "x-api-key: $DOKPLOY_API_KEY" https://$DOKPLOY_HOST/api/project.all | python3 -m json.tool

# one project's full tree (find composeId / applicationId / environmentId)
curl -s -H "x-api-key: $DOKPLOY_API_KEY" "https://$DOKPLOY_HOST/api/project.one?projectId=PROJECT_ID" | python3 -m json.tool
```

## The 10 operations you actually use

```bash
K="x-api-key: $DOKPLOY_API_KEY"; B=https://$DOKPLOY_HOST/api; J="Content-Type: application/json"

# 1. Deploy a compose service
curl -s -H "$K" -H "$J" -X POST $B/compose.deploy   -d '{"composeId":"COMPOSE_ID"}'
# 2. Redeploy (rebuild) a compose
curl -s -H "$K" -H "$J" -X POST $B/compose.redeploy -d '{"composeId":"COMPOSE_ID"}'
# 3. Stop / 4. Start a compose
curl -s -H "$K" -H "$J" -X POST $B/compose.stop  -d '{"composeId":"COMPOSE_ID"}'
curl -s -H "$K" -H "$J" -X POST $B/compose.start -d '{"composeId":"COMPOSE_ID"}'
# 5. Deploy an application (git/docker app, not compose)
curl -s -H "$K" -H "$J" -X POST $B/application.deploy   -d '{"applicationId":"APP_ID"}'
# 6. Redeploy an application
curl -s -H "$K" -H "$J" -X POST $B/application.redeploy -d '{"applicationId":"APP_ID"}'
# 7. Read a compose's config
curl -s -H "$K" "$B/compose.one?composeId=COMPOSE_ID" | python3 -m json.tool
# 8. Restart a raw container
curl -s -H "$K" -H "$J" -X POST $B/docker.restartContainer -d '{"containerId":"NAME_OR_ID"}'
# 9. Create a domain on a service (Traefik + letsencrypt)
curl -s -H "$K" -H "$J" -X POST $B/domain.create -d '{
  "host":"sub.example.com","composeId":"COMPOSE_ID","serviceName":"svc",
  "port":8080,"https":true,"certificateType":"letsencrypt","domainType":"compose","path":"/"}'
# 10. Create a raw-compose service in a project environment
curl -s -H "$K" -H "$J" -X POST $B/compose.create -d '{
  "name":"myservice","environmentId":"ENV_ID","composeType":"docker-compose"}'
# (then compose.update with sourceType:"raw" + composeFile, then compose.deploy)
```

## Notes / gotchas

- **Get IDs from `project.one` first** — deploy/domain calls need composeId / applicationId / environmentId / serverId.
- **Raw compose flow:** `compose.create` → `compose.update` (`{"composeId":..,"sourceType":"raw","composeFile":"<yaml>"}`) → `domain.create` → `compose.deploy`.
- **Full API surface** (all 546 procedures) is at `GET /api/settings.getOpenApiDocument` — fetch it only when you need an operation not listed above, so it never sits in context.
- If a call returns `UNAUTHORIZED`, the key is wrong/missing; check `$DOKPLOY_API_KEY`.
- Tested against Dokploy v0.29.x.
