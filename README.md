# Homey MCP Server

This is an MCP server for Homey (by Athom) that allows AI agents to control smart home devices, trigger flows, and query zones.

## Prerequisites

- **Homey Pro** or **Homey Cloud**
- **Homey Personal Access Token** (API Key). You can create one in the Homey Web App under `Settings → API Keys`.

## Installation

1. Clone or copy this directory.
2. Run `npm install`.
3. Create a `.env` file based on `.env.example`:
   ```bash
   HOMEY_TOKEN=your_token_here
   ```

## Usage

### Connecting with Claude Desktop

Add the following to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "homey": {
      "command": "node",
      "args": ["/Users/kjetilvetlejord/.gemini/antigravity/scratch/homey-mcp/index.js"],
      "env": {
        "HOMEY_TOKEN": "YOUR_TOKEN_HERE"
      }
    }
  }
}
```

### Available Tools

- `homey_list_devices`: Get all devices and their current states (ID, Name, Zone, Class, Capabilities).
- `homey_get_device`: Get full details for a single device by its ID.
- `homey_set_capability`: Set a capability value (e.g., `onoff: true`, `dim: 0.5`, `target_temperature: 21`).
- `homey_list_flows`: List all flows available on the Homey.
- `homey_run_flow`: Trigger a flow by its ID.
- `homey_list_zones`: List all zones (rooms/floors) configured in Homey.

## Troubleshooting

### "HomeyAPI.createCloudAPI is not a function"
This usually happens if the Personal Access Token is used without a `HOMEY_IP`. Ensure you provide `HOMEY_IP` for Homey Pro local connections. For Homey Cloud, Ensure your token is valid and specifically created for the Web API.

### Connection Closed / MCP Error
If the server fails to connect to Homey, it will now start gracefully but return an error message when you try to use a tool. Check the console logs (stderr) for the specific connection error.

### Environment Variables
If running via Claude Desktop, ensure the `env` section in your config contains the correct `HOMEY_TOKEN` and optionally `HOMEY_IP`.
