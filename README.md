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

### Available Tools (19 Total)

#### 🏠 Devices & Control
- `homey_list_devices`: List all devices with their current states (ID, Name, Zone, Class, Capabilities).
- `homey_get_device`: Get full details for a single device by its ID.
- `homey_get_sensor_readings`: Get current readings from all sensors (temperature, humidity, motion, etc.) across the home.
- `homey_find_devices_by_zone`: List all devices in a specific room or floor.
- `homey_control_lights_in_zone`: Bulk control for all lights in a specific zone (Turn on/off).
- `homey_set_capability`: Set a specific capability value (e.g., `onoff`, `dim`, `target_temperature`).

#### 🚀 Flows & Automation
- `homey_list_flows`: List all standard flows.
- `homey_list_advanced_flows`: List all Advanced Flows.
- `homey_run_flow`: Trigger a standard flow by its ID.
- `homey_run_advanced_flow`: Trigger an Advanced Flow by its ID.
- `homey_get_flow`: Get full configuration details for a specific flow.
- `homey_get_flow_folders`: List the folder structure used to organize flows.

#### 📍 Zones
- `homey_list_zones`: List all zones (rooms/floors) and their hierarchy.

#### 🧠 Logic & Flow Cards
- `homey_get_flow_cards`: List available flow cards (triggers, conditions, actions) on the system.
- `homey_run_flow_card_action`: Execute a specific flow card action directly without needing a flow.
- `homey_get_device_flow_capabilities`: Identify which flow cards are applicable to a specific device.

#### 📊 Data & Insights
- `homey_get_energy_data`: Discover and list available energy/power logs.
- `homey_get_device_insights`: Fetch historical data logs for any device capability over a period (`today`, `last7days`, etc.).
- `homey_get_live_insights`: Access real-time dashboard data for device capabilities.

## Troubleshooting

### "HomeyAPI.createCloudAPI is not a function"
This usually happens if the Personal Access Token is used without a `HOMEY_IP`. Ensure you provide `HOMEY_IP` for Homey Pro local connections. For Homey Cloud, Ensure your token is valid and specifically created for the Web API.

### Connection Closed / MCP Error
If the server fails to connect to Homey, it will now start gracefully but return an error message when you try to use a tool. Check the console logs (stderr) for the specific connection error.

### Environment Variables
If running via Claude Desktop, ensure the `env` section in your config contains the correct `HOMEY_TOKEN` and optionally `HOMEY_IP`.
