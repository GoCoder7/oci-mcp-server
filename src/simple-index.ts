#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';

/**
 * Oracle Cloud Infrastructure (OCI) MCP Server
 * 
 * A simplified implementation that provides basic OCI functionality
 * through a single unified tool interface
 */

class OCIMCPServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: 'oci-mcp-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
    this.setupErrorHandling();
  }

  private setupToolHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'oci-manage',
            description: 'Manage Oracle Cloud Infrastructure resources including compute, storage, networking, databases, and monitoring.',
            inputSchema: {
              type: 'object',
              properties: {
                service: {
                  type: 'string',
                  enum: ['compute', 'storage', 'network', 'database', 'monitoring', 'identity'],
                  description: 'The OCI service to interact with'
                },
                action: {
                  type: 'string',
                  enum: ['list', 'get', 'create', 'update', 'delete', 'start', 'stop'],
                  description: 'The action to perform'
                },
                resourceType: {
                  type: 'string',
                  description: 'The type of resource (e.g., instances, buckets, vcns)'
                },
                resourceId: {
                  type: 'string',
                  description: 'The OCID of the resource (for specific operations)'
                },
                compartmentId: {
                  type: 'string',
                  description: 'The compartment OCID (optional, defaults to tenancy)'
                },
                parameters: {
                  type: 'object',
                  description: 'Additional parameters for the operation'
                }
              },
              required: ['service', 'action', 'resourceType']
            }
          }
        ]
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'oci-manage':
            return await this.handleOCIManage(args);
          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${name}`
            );
        }
      } catch (error) {
        if (error instanceof McpError) {
          throw error;
        }
        
        console.error(`Error in tool ${name}:`, error);
        throw new McpError(
          ErrorCode.InternalError,
          `Tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    });
  }

  private async handleOCIManage(args: any) {
    // Basic validation
    if (!args.service || !args.action || !args.resourceType) {
      throw new McpError(
        ErrorCode.InvalidParams,
        'Missing required parameters: service, action, resourceType'
      );
    }

    // Check if OCI credentials are configured
    const requiredEnvVars = [
      'OCI_TENANCY_ID',
      'OCI_USER_ID', 
      'OCI_KEY_FINGERPRINT',
      'OCI_PRIVATE_KEY_PATH',
      'OCI_REGION'
    ];

    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              message: `OCI credentials not configured. Please set the following environment variables: ${missingVars.join(', ')}`,
              help: {
                setup: 'Configure OCI authentication by setting environment variables',
                variables: {
                  OCI_TENANCY_ID: 'Your OCI tenancy OCID',
                  OCI_USER_ID: 'Your OCI user OCID', 
                  OCI_KEY_FINGERPRINT: 'Your API key fingerprint',
                  OCI_PRIVATE_KEY_PATH: 'Path to your private key file',
                  OCI_REGION: 'Your preferred OCI region (e.g., us-ashburn-1)'
                },
                example: {
                  service: 'compute',
                  action: 'list', 
                  resourceType: 'instances',
                  compartmentId: 'ocid1.compartment.oc1..aaaaaaaa...'
                }
              }
            }, null, 2)
          }
        ]
      };
    }

    // For now, return a mock response indicating the operation would be performed
    const response = {
      success: true,
      service: args.service,
      action: args.action,
      resourceType: args.resourceType,
      resourceId: args.resourceId,
      compartmentId: args.compartmentId || process.env.OCI_COMPARTMENT_ID || process.env.OCI_TENANCY_ID,
      message: `Would ${args.action} ${args.resourceType} in ${args.service} service`,
      note: 'This is a placeholder response. Full OCI integration requires the complete implementation.',
      credentials_configured: true,
      region: process.env.OCI_REGION
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response, null, 2)
        }
      ]
    };
  }

  private setupErrorHandling(): void {
    this.server.onerror = (error) => {
      console.error('[MCP Error]', error);
    };

    process.on('SIGINT', async () => {
      console.log('Shutting down OCI MCP Server...');
      await this.server.close();
      process.exit(0);
    });
  }

  public async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.log('OCI MCP Server running on stdio');
  }
}

// Start the server
const server = new OCIMCPServer();
server.start().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});

export { OCIMCPServer };
