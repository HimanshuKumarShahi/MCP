import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { GoogleGenAI } from "@google/genai";
import * as dotenv from "dotenv";
import * as readline from "readline";

dotenv.config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function runClient() {
  console.log("Starting MCP Client and connecting to local server...");

  const transport = new StdioClientTransport({
    command: "npx",
    args: ["tsx", "src/server.ts"],
  });

  const mcpClient = new Client(
    { name: "my-ai-client", version: "1.0.0" },
    { capabilities: {} },
  );

  await mcpClient.connect(transport);
  console.log("✅ Connected to local MCP server!");

  const toolsResponse = await mcpClient.listTools();

  const geminiTools = toolsResponse.tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    parameters: tool.inputSchema as any,
  }));

  console.log(
    "🛠️  Tools given to Gemini:",
    geminiTools.map((t) => t.name).join(", "),
  );

  const chat = ai.chats.create({
    model: "gemini-3.1-flash-lite",
    config: {
      tools: [{ functionDeclarations: geminiTools }],
    },
  });

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  console.log('\n🤖 AI Agent is ready! (Type "exit" to quit)');

  const ask = () => {
    rl.question("\nYou: ", async (userInput) => {
      if (userInput.toLowerCase() === "exit") process.exit(0);

      console.log("Gemini is thinking...");
      try {
        const response = await chat.sendMessage({ message: userInput });

        if (response.functionCalls && response.functionCalls.length > 0) {
          for (const call of response.functionCalls) {
            console.log(`\n🔧 Gemini wants to use tool: ${call.name}`);

            const result = await mcpClient.callTool({
              name: call.name as string,
              arguments: call.args as Record<string, unknown>,
            });

            const resultText = (result.content as any)[0].text;
            console.log(`📊 Tool output: ${resultText}`);

            console.log("Gemini is reading the output...");
            const finalResponse = await chat.sendMessage({
              message: `Tool execution complete. Result:\n${resultText}`,
            });

            console.log(`\n🤖 Gemini: ${finalResponse.text}`);
          }
        } else {
          console.log(`\n🤖 Gemini: ${response.text}`);
        }
      } catch (error: any) {
        console.error("Error talking to Gemini:", error.message);
      }

      ask();
    });
  };

  ask();
}

runClient();
