import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import * as z from 'zod';
import * as fs from 'fs/promises';

const server = new McpServer({ name: 'multi-purpose-agent', version: '1.0.0' });

server.registerTool(
    'get-weather-alerts',
    {
        description: 'Get active weather alerts for a state using the  API',
        inputSchema: z.object({
            state: z.string().length(2).describe('Two-letter state code')
        })
    },
    async (args: { state: string }) => {
        try {
            const url = `https://api.weather.gov/alerts/active?area=${args.state.toUpperCase()}`;

            const res = await fetch(url, { headers: { 'User-Agent': 'mcp-agent/1.0' } });
            
            if (!res.ok) {
                return { content: [{ type: 'text', text: `API error: HTTP ${res.status}` }], isError: true };
            }
            
            const data = await res.json();
            const features = data.features || [];
            
            if (features.length === 0) {
                return { content: [{ type: 'text', text: `No active alerts for ${args.state.toUpperCase()}.` }] };
            }
            
            const lines = features.map((f: any) => f.properties.headline ?? f.properties.event ?? 'Unnamed alert');
            return { content: [{ type: 'text', text: lines.join('\n') }] };
            
        } catch (error: any) {
            return { content: [{ type: 'text', text: `Error fetching weather: ${error.message}` }], isError: true };
        }
    }
);

server.registerTool(
    'save-blog-post',
    {
        description: 'Saves a generated markdown blog post to a local file on the computer',
        inputSchema: z.object({
            title: z.string().describe('The title of the blog post'),
            content: z.string().describe('The markdown content of the blog post')
        })
    },
    async (args: { title: string; content: string }) => {
        try {
            const filename = `${args.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.md`;
            const fileContent = `# ${args.title}\n\n${args.content}`;
            
            await fs.writeFile(filename, fileContent, 'utf-8');
            
            return { 
                content: [{ 
                    type: 'text', 
                    text: `Success! Blog post saved locally as ${filename}` 
                }] 
            };
        } catch (error: any) {
            return { 
                content: [{ type: 'text', text: `Failed to save file: ${error.message}` }], 
                isError: true 
            };
        }
    }
);

async function run() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('Multi-purpose MCP Server is running...'); 
}

run();