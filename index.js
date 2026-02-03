#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { HomeyAPI } from "homey-api";
import fs from "node:fs";
import path from "node:path";

// Manually load .env to avoid library-specific stdout pollution (like dotenv/dotenvx "tips")
function loadEnv() {
  try {
    const envPath = path.resolve(process.cwd(), ".env");
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf8");
      content.split(/\r?\n/).forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) return;
        const [key, ...valueParts] = trimmed.split("=");
        if (key && valueParts.length > 0) {
          const value = valueParts.join("=").trim().replace(/^["']|["']$/g, "");
          process.env[key.trim()] = value;
        }
      });
    }
  } catch (error) {
    console.error("Note: Manual .env loading skipped:", error.message);
  }
}

loadEnv();

const HOMEY_TOKEN = process.env.HOMEY_TOKEN;
const HOMEY_IP = process.env.HOMEY_IP;

if (!HOMEY_TOKEN) {
  console.error("HOMEY_TOKEN environment variable is required");
  process.exit(1);
}

let homey;

async function connect() {
  try {
    if (HOMEY_IP) {
      const address = HOMEY_IP.startsWith('http') ? HOMEY_IP : `http://${HOMEY_IP}`;
      console.error(`Connecting to Homey locally at ${address}...`);
      homey = await HomeyAPI.createLocalAPI({
        address: address,
        token: HOMEY_TOKEN,
      });
    } else {
      console.error("Connecting to Homey via Cloud Token...");
      // In v3.x of homey-api, for external scripts, we often need to use 
      // HomeyAPI.createCloudAPI if using OAuth or similar.
      // However, if the user provided a Personal Access Token, 
      // they might be expecting it to work with a generic cloud instance.
      // If createCloudAPI is missing, we try to use a more generic approach 
      // or assume it's a local-style token for a specific Homey.

      // Attempting to use createLocalAPI without an IP if the SDK supports it, 
      // or providing a way to fail gracefully.
      try {
        homey = await HomeyAPI.createLocalAPI({
          token: HOMEY_TOKEN,
        });
      } catch (e) {
        console.error("Local API failed, attempting generic Cloud API initialization...");
        // Fallback or detailed error
        throw new Error("Cloud connection requires OAuth2 or specific Homey ID. Please use HOMEY_IP for Local API.");
      }
    }
    console.error("Connected to Homey!");
  } catch (error) {
    console.error("Warning: Failed to connect to Homey:", error.message);
    console.error("The server will still start, but tools requiring live data will fail.");
  }
}

const server = new Server(
  {
    name: "homey-mcp",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "homey_list_devices",
        description: "List all devices on Homey with their current states.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "homey_get_sensor_readings",
        description: "Get current readings from all sensors (temperature, humidity, motion, etc.) across the home.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "homey_get_device",
        description: "Get detailed information about a specific device by ID.",
        inputSchema: {
          type: "object",
          properties: {
            id: { type: "string", description: "The ID of the device" },
          },
          required: ["id"],
        },
      },
      {
        name: "homey_find_devices_by_zone",
        description: "List all devices in a specific zone (room or floor).",
        inputSchema: {
          type: "object",
          properties: {
            zoneName: { type: "string", description: "The name of the zone (e.g. 'Living Room')" },
            zoneId: { type: "string", description: "The ID of the zone (optional)" },
          },
        },
      },
      {
        name: "homey_control_lights_in_zone",
        description: "Turn all lights in a specific zone on or off.",
        inputSchema: {
          type: "object",
          properties: {
            zoneName: { type: "string", description: "The name of the zone" },
            on: { type: "boolean", description: "True to turn on, False to turn off" },
          },
          required: ["zoneName", "on"],
        },
      },
      {
        name: "homey_set_capability",
        description: "Set a capability value on a device (e.g. turn on/off, dim, target_temperature).",
        inputSchema: {
          type: "object",
          properties: {
            deviceId: { type: "string", description: "The ID of the device" },
            capabilityId: { type: "string", description: "The ID of the capability (e.g. onoff, dim, target_temperature, light_hue)" },
            value: { type: ["boolean", "number", "string"], description: "The value to set" },
          },
          required: ["deviceId", "capabilityId", "value"],
        },
      },
      {
        name: "homey_list_flows",
        description: "List all standard flows on Homey.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "homey_list_advanced_flows",
        description: "List all Advanced Flows on Homey.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "homey_run_flow",
        description: "Trigger a specific standard flow.",
        inputSchema: {
          type: "object",
          properties: {
            id: { type: "string", description: "The ID of the flow" },
          },
          required: ["id"],
        },
      },
      {
        name: "homey_run_advanced_flow",
        description: "Trigger a specific Advanced Flow.",
        inputSchema: {
          type: "object",
          properties: {
            id: { type: "string", description: "The ID of the flow" },
          },
          required: ["id"],
        },
      },
      {
        name: "homey_list_zones",
        description: "List all zones (rooms/floors) and their hierarchy.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "homey_get_energy_data",
        description: "Get energy consumption logs for devices.",
        inputSchema: {
          type: "object",
          properties: {
            deviceId: { type: "string", description: "Optional: ID of a specific device" },
          },
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (!homey) {
      throw new Error("Homey is not connected. Check your HOMEY_TOKEN and/or HOMEY_IP.");
    }
    switch (name) {
      case "homey_list_devices": {
        const devices = await homey.devices.getDevices();
        const output = Object.values(devices).map(d => {
          const zone = d.zoneName || "Unknown Zone";
          return `🏠 [${zone}] ${d.name} (${d.class})\n   ID: ${d.id}\n   State: ${JSON.stringify(d.capabilitiesObj)}`;
        }).join('\n\n');
        return {
          content: [{ type: "text", text: `Total Devices: ${Object.keys(devices).length}\n\n${output}` }],
        };
      }

      case "homey_get_sensor_readings": {
        const devices = await homey.devices.getDevices();
        const sensors = Object.values(devices).filter(d =>
          d.class === 'sensor' || d.capabilities.some(c => c.startsWith('measure_'))
        );
        const output = sensors.map(s => {
          const readings = Object.entries(s.capabilitiesObj)
            .filter(([cap]) => cap.startsWith('measure_'))
            .map(([cap, val]) => `${cap}: ${val}`)
            .join(', ');
          return `🌡️ ${s.name} (${s.zoneName}): ${readings || "No active measures"}`;
        }).join('\n');
        return {
          content: [{ type: "text", text: output || "No sensors found." }],
        };
      }

      case "homey_get_device": {
        const device = await homey.devices.getDevice({ id: args.id });
        return {
          content: [{ type: "text", text: JSON.stringify(device, null, 2) }],
        };
      }

      case "homey_find_devices_by_zone": {
        const [devices, zones] = await Promise.all([
          homey.devices.getDevices(),
          homey.zones.getZones()
        ]);

        let targetZoneId = args.zoneId;
        if (!targetZoneId && args.zoneName) {
          const zone = Object.values(zones).find(z => z.name.toLowerCase() === args.zoneName.toLowerCase());
          if (zone) targetZoneId = zone.id;
        }

        if (!targetZoneId) throw new Error(`Zone not found: ${args.zoneName || args.zoneId}`);

        const zoneDevices = Object.values(devices).filter(d => d.zone === targetZoneId);
        const output = zoneDevices.map(d => `- ${d.name} (${d.class}) [ID: ${d.id}]`).join('\n');
        return {
          content: [{ type: "text", text: `Devices in ${args.zoneName || targetZoneId}:\n${output || "No devices in this zone."}` }],
        };
      }

      case "homey_control_lights_in_zone": {
        const [devices, zones] = await Promise.all([
          homey.devices.getDevices(),
          homey.zones.getZones()
        ]);

        const zone = Object.values(zones).find(z => z.name.toLowerCase() === args.zoneName.toLowerCase());
        if (!zone) throw new Error(`Zone not found: ${args.zoneName}`);

        const lights = Object.values(devices).filter(d =>
          d.zone === zone.id && (d.class === 'light' || d.capabilities.includes('onoff'))
        );

        let successCount = 0;
        for (const light of lights) {
          try {
            const dev = await homey.devices.getDevice({ id: light.id });
            await dev.setCapabilityValue({ capabilityId: 'onoff', value: args.on });
            successCount++;
          } catch (e) {
            console.error(`Failed to control light ${light.name}:`, e.message);
          }
        }

        return {
          content: [{ type: "text", text: `💡 Successfully turned ${args.on ? 'on' : 'off'} ${successCount} lights in ${zone.name}.` }],
        };
      }

      case "homey_set_capability": {
        const device = await homey.devices.getDevice({ id: args.deviceId });
        await device.setCapabilityValue({
          capabilityId: args.capabilityId,
          value: args.value,
        });
        return {
          content: [{ type: "text", text: `✅ Successfully set ${args.capabilityId} to ${args.value} on ${device.name}` }],
        };
      }

      case "homey_list_flows": {
        const flows = await homey.flow.getFlows();
        const output = Object.values(flows)
          .map(f => `- ${f.name} [ID: ${f.id}] (${f.enabled ? 'Enabled' : 'Disabled'})`)
          .join('\n');
        return {
          content: [{ type: "text", text: `Standard Flows:\n${output}` }],
        };
      }

      case "homey_list_advanced_flows": {
        // Advanced Flows are typically in homey.advflow or equivalent depending on SDK version
        // In some versions they are mixed in flows or listed separately.
        const flows = await (homey.advflow ? homey.advflow.getAdvancedFlows() : homey.flow.getAdvancedFlows());
        const output = Object.values(flows)
          .map(f => `- ${f.name} [ID: ${f.id}]`)
          .join('\n');
        return {
          content: [{ type: "text", text: `Advanced Flows:\n${output}` }],
        };
      }

      case "homey_run_flow": {
        await homey.flow.runFlow({ id: args.id });
        return {
          content: [{ type: "text", text: `🚀 Successfully triggered standard flow: ${args.id}` }],
        };
      }

      case "homey_run_advanced_flow": {
        const advFlow = await (homey.advflow ? homey.advflow.getAdvancedFlow({ id: args.id }) : homey.flow.getAdvancedFlow({ id: args.id }));
        await advFlow.trigger();
        return {
          content: [{ type: "text", text: `🚀 Successfully triggered Advanced Flow: ${args.id}` }],
        };
      }

      case "homey_list_zones": {
        const zones = await homey.zones.getZones();
        const output = Object.values(zones).map(z => {
          return `📍 ${z.name} [ID: ${z.id}]${z.parent ? ` (Parent: ${z.parent})` : ''}`;
        }).join('\n');
        return {
          content: [{ type: "text", text: `Zones:\n${output}` }],
        };
      }

      case "homey_get_energy_data": {
        // Insights are available via homey.insights
        const logs = await homey.insights.getLogs();
        const energyLogs = logs.filter(l => l.name.includes('meter_power') || l.name.includes('measure_power'));

        let output = energyLogs.map(l => `- ${l.name} (${l.id})`).join('\n');
        return {
          content: [{ type: "text", text: `Available Energy Logs:\n${output || "No energy logs found."}\n\nNote: Visualizing historical data requires specific log IDs.` }],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      isError: true,
      content: [{ type: "text", text: `Error: ${error.message}` }],
    };
  }
});

async function main() {
  await connect();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Homey MCP server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
