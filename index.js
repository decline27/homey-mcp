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
        description: "List all devices on Homey",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "homey_get_device",
        description: "Get detailed information about a specific device",
        inputSchema: {
          type: "object",
          properties: {
            id: { type: "string", description: "The ID of the device" },
          },
          required: ["id"],
        },
      },
      {
        name: "homey_set_capability",
        description: "Set a capability value on a device (e.g. turn on/off, dim)",
        inputSchema: {
          type: "object",
          properties: {
            deviceId: { type: "string", description: "The ID of the device" },
            capabilityId: { type: "string", description: "The ID of the capability (e.g. onoff, dim, target_temperature)" },
            value: { type: ["boolean", "number", "string"], description: "The value to set" },
          },
          required: ["deviceId", "capabilityId", "value"],
        },
      },
      {
        name: "homey_list_flows",
        description: "List all flows on Homey",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "homey_run_flow",
        description: "Trigger a specific flow",
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
        description: "List all zones (rooms/floors)",
        inputSchema: {
          type: "object",
          properties: {},
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
        const devicesSummary = Object.values(devices).map((d) => ({
          id: d.id,
          name: d.name,
          zone: d.zoneName,
          class: d.class,
          capabilities: d.capabilities,
          state: d.capabilitiesObj,
        }));
        return {
          content: [{ type: "text", text: JSON.stringify(devicesSummary, null, 2) }],
        };
      }

      case "homey_get_device": {
        const device = await homey.devices.getDevice({ id: args.id });
        return {
          content: [{ type: "text", text: JSON.stringify(device, null, 2) }],
        };
      }

      case "homey_set_capability": {
        const device = await homey.devices.getDevice({ id: args.deviceId });
        await device.setCapabilityValue({
          capabilityId: args.capabilityId,
          value: args.value,
        });
        return {
          content: [{ type: "text", text: `Successfully set ${args.capabilityId} to ${args.value} on ${device.name}` }],
        };
      }

      case "homey_list_flows": {
        const flows = await homey.flow.getFlows();
        const flowsSummary = Object.values(flows).map((f) => ({
          id: f.id,
          name: f.name,
          enabled: f.enabled,
        }));
        return {
          content: [{ type: "text", text: JSON.stringify(flowsSummary, null, 2) }],
        };
      }

      case "homey_run_flow": {
        await homey.flow.runFlow({ id: args.id });
        return {
          content: [{ type: "text", text: `Successfully triggered flow with ID ${args.id}` }],
        };
      }

      case "homey_list_zones": {
        const zones = await homey.zones.getZones();
        return {
          content: [{ type: "text", text: JSON.stringify(zones, null, 2) }],
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
