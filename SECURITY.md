# Security

## Reporting a vulnerability

If you find a security issue, please report it privately instead of opening a
public GitHub issue. Contact: [GitHub Security Advisories](https://github.com/JIROMO/Millrect/security/advisories/new)
or open a private report via the repository maintainer.

## MCP WebSocket

When Millrect is running, a local WebSocket server is started for MCP integration.
It binds to `127.0.0.1` only and requires a per-session token written to the
system temp directory. Do not expose this port beyond localhost.
