// agent-mcp-inspect.mjs
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { runJsOnDevice, screenshotDevice } from "./agent-relay-client.js";

const server = new McpServer({ name: "warboard-inspect", version: "1.0.0" });

server.tool(
  "inspect_run_js",
  "Run JavaScript in the MAIN world of the live Torn page inside the Warboard app's WebView and return the JSON-stringified result. Write `return <expr>;`. Prefer serializing DOM/state to text over screenshots.",
  { js: z.string().describe("JS body; use `return ...` to produce a value") },
  async ({ js }) => {
    let r;
    try {
      r = await runJsOnDevice(js);
    } catch (e) {
      return { content: [{ type: "text", text: "ERROR: " + (e && e.message ? e.message : String(e)) }] };
    }
    return { content: [{ type: "text", text: r.error ? "ERROR: " + r.error : (r.value ?? "null") }] };
  }
);

server.tool(
  "inspect_screenshot",
  "Request a downscaled PNG screenshot of the live Torn page. Returns a reference id; screenshots may be unavailable if the app is backgrounded.",
  {},
  async () => {
    let r;
    try {
      r = await screenshotDevice();
    } catch (e) {
      return { content: [{ type: "text", text: "ERROR: " + (e && e.message ? e.message : String(e)) }] };
    }
    return { content: [{ type: "text", text: r.error ? "ERROR: " + r.error : ("screenshot queued: " + r.ref) }] };
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
