#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';

import { ComputeManager, ComputeToolInputSchema } from './tools/compute';
import { StorageNetworkManager, StorageNetworkToolInputSchema } from './tools/storage-network';
import { DatabaseAnalyticsManager, DatabaseAnalyticsToolInputSchema } from './tools/database-analytics';
import { MonitoringSecurityManager, MonitoringSecurityToolInputSchema } from './tools/monitoring-security';
import { getOCIClient, resetOCIClient } from './utils/oci-client';

/**
 * Oracle Cloud Infrastructure (OCI) MCP Server
 * 
 * This server provides a comprehensive interface to Oracle Cloud Infrastructure
 * through four unified tools that cover all major OCI services:
 * 
 * 1. oci-compute: Compute instances, volumes, shapes, images
 * 2. oci-storage-network: Object storage, VCNs, subnets, security, load balancers
 * 3. oci-database-analytics: Database systems, autonomous databases, backups
 * 4. oci-monitoring-security: Alarms, metrics, logs, security groups, IAM
 */

class OCIMCPServer {
  private server: Server;
  private computeManager: ComputeManager;
  private storageNetworkManager: StorageNetworkManager;
  private databaseAnalyticsManager: DatabaseAnalyticsManager;
  private monitoringSecurityManager: MonitoringSecurityManager;

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

    this.computeManager = new ComputeManager();
    this.storageNetworkManager = new StorageNetworkManager();
    this.databaseAnalyticsManager = new DatabaseAnalyticsManager();
    this.monitoringSecurityManager = new MonitoringSecurityManager();

    this.setupToolHandlers();
    this.setupErrorHandling();
  }

  private setupToolHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'oci-compute',
            description: 'Manage OCI compute resources including instances, volumes, shapes, and images. Supports listing, creating, managing (start/stop/reboot), and volume operations.',
            inputSchema: {
              type: 'object',
              properties: {
                action: {
                  type: 'string',
                  enum: ['list', 'get', 'create', 'start', 'stop', 'reboot', 'terminate', 'attach-volume', 'detach-volume'],
                  description: 'The action to perform on compute resources'
                },
                resourceType: {
                  type: 'string',
                  enum: ['instances', 'instance', 'images', 'image', 'shapes', 'volumes', 'volume', 'volume-attachments', 'volume-attachment'],
                  description: 'The type of compute resource to work with'
                },
                resourceId: {
                  type: 'string',
                  description: 'The OCID of the resource (for get/manage actions)'
                },
                compartmentId: {
                  type: 'string',
                  description: 'The compartment OCID (optional, defaults to tenancy root)'
                },
                data: {
                  type: 'object',
                  description: 'Data for resource creation (required for create action)'
                }
              },
              required: ['action', 'resourceType']
            }
          },
          {
            name: 'oci-storage-network',
            description: 'Manage OCI storage and networking resources including object storage, VCNs, subnets, security lists, gateways, and load balancers.',
            inputSchema: {
              type: 'object',
              properties: {
                action: {
                  type: 'string',
                  enum: ['list', 'get', 'create', 'upload-object', 'download-object', 'delete-object', 'delete-bucket', 'delete-vcn', 'update-security-list'],
                  description: 'The action to perform on storage/network resources'
                },
                resourceType: {
                  type: 'string',
                  enum: ['buckets', 'bucket', 'objects', 'object', 'vcns', 'vcn', 'subnets', 'subnet', 'security-lists', 'security-list', 'route-tables', 'route-table', 'internet-gateways', 'internet-gateway', 'nat-gateways', 'nat-gateway', 'load-balancers', 'load-balancer'],
                  description: 'The type of storage/network resource to work with'
                },
                resourceId: {
                  type: 'string',
                  description: 'The OCID or name of the resource'
                },
                compartmentId: {
                  type: 'string',
                  description: 'The compartment OCID (optional, defaults to tenancy root)'
                },
                data: {
                  type: 'object',
                  description: 'Data for resource creation (required for create action)'
                }
              },
              required: ['action', 'resourceType']
            }
          },
          {
            name: 'oci-database-analytics',
            description: 'Manage OCI database and analytics resources including DB systems, autonomous databases, backups, and analytics instances.',
            inputSchema: {
              type: 'object',
              properties: {
                action: {
                  type: 'string',
                  enum: ['list', 'get', 'create', 'start-database', 'stop-database', 'restart-database', 'start-autonomous-db', 'stop-autonomous-db', 'scale-autonomous-db', 'restore-database', 'clone-database', 'delete-backup'],
                  description: 'The action to perform on database/analytics resources'
                },
                resourceType: {
                  type: 'string',
                  enum: ['db-systems', 'db-system', 'databases', 'database', 'autonomous-databases', 'autonomous-database', 'db-homes', 'db-home', 'db-nodes', 'backups', 'backup', 'analytics-instances', 'analytics-instance'],
                  description: 'The type of database/analytics resource to work with'
                },
                resourceId: {
                  type: 'string',
                  description: 'The OCID of the resource'
                },
                compartmentId: {
                  type: 'string',
                  description: 'The compartment OCID (optional, defaults to tenancy root)'
                },
                data: {
                  type: 'object',
                  description: 'Data for resource creation (required for create action)'
                }
              },
              required: ['action', 'resourceType']
            }
          },
          {
            name: 'oci-monitoring-security',
            description: 'Manage OCI monitoring and security resources including alarms, metrics, logs, security groups, IAM policies, users, and groups.',
            inputSchema: {
              type: 'object',
              properties: {
                action: {
                  type: 'string',
                  enum: ['list', 'get', 'create', 'enable-alarm', 'disable-alarm', 'update-alarm', 'delete-alarm', 'add-security-rule', 'remove-security-rule', 'add-user-to-group', 'remove-user-from-group', 'attach-policy', 'detach-policy'],
                  description: 'The action to perform on monitoring/security resources'
                },
                resourceType: {
                  type: 'string',
                  enum: ['alarms', 'alarm', 'metrics', 'metric', 'metric-data', 'log-groups', 'log-group', 'logs', 'log', 'network-security-groups', 'network-security-group', 'security-lists', 'security-list', 'policies', 'policy', 'users', 'user', 'groups', 'group'],
                  description: 'The type of monitoring/security resource to work with'
                },
                resourceId: {
                  type: 'string',
                  description: 'The OCID of the resource'
                },
                compartmentId: {
                  type: 'string',
                  description: 'The compartment OCID (optional, defaults to tenancy root)'
                },
                data: {
                  type: 'object',
                  description: 'Data for resource creation (required for create action)'
                }
              },
              required: ['action', 'resourceType']
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
          case 'oci-compute':
            return await this.handleComputeTool(args);
          case 'oci-storage-network':
            return await this.handleStorageNetworkTool(args);
          case 'oci-database-analytics':
            return await this.handleDatabaseAnalyticsTool(args);
          case 'oci-monitoring-security':
            return await this.handleMonitoringSecurityTool(args);
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

  private async handleComputeTool(args: any) {
    try {
      const validatedInput = ComputeToolInputSchema.parse(args);
      const result = await this.computeManager.execute(validatedInput);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }
        ]
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Invalid compute tool input: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private async handleStorageNetworkTool(args: any) {
    try {
      const validatedInput = StorageNetworkToolInputSchema.parse(args);
      const result = await this.storageNetworkManager.execute(validatedInput);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }
        ]
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Invalid storage/network tool input: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private async handleDatabaseAnalyticsTool(args: any) {
    try {
      const validatedInput = DatabaseAnalyticsToolInputSchema.parse(args);
      const result = await this.databaseAnalyticsManager.execute(validatedInput);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }
        ]
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Invalid database/analytics tool input: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private async handleMonitoringSecurityTool(args: any) {
    try {
      const validatedInput = MonitoringSecurityToolInputSchema.parse(args);
      const result = await this.monitoringSecurityManager.execute(validatedInput);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }
        ]
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Invalid monitoring/security tool input: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  private setupErrorHandling(): void {
    this.server.onerror = (error) => {
      console.error('[MCP Error]', error);
    };

    process.on('SIGINT', async () => {
      console.log('Shutting down OCI MCP Server...');
      resetOCIClient();
      await this.server.close();
      process.exit(0);
    });
  }

  public async start(): Promise<void> {
    // Test OCI connection on startup
    try {
      const ociClient = getOCIClient();
      const connectionTest = await ociClient.testConnection();
      
      if (!connectionTest) {
        console.warn('Warning: OCI connection test failed. Please check your authentication configuration.');
        console.warn('Server will start but OCI operations may fail.');
      } else {
        console.log('OCI connection test passed successfully.');
      }
    } catch (error) {
      console.warn('Warning: Could not test OCI connection:', error instanceof Error ? error.message : 'Unknown error');
      console.warn('Server will start but you may need to configure OCI authentication.');
    }

    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.log('OCI MCP Server running on stdio');
  }
}

// Start the server
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new OCIMCPServer();
  server.start().catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
}

export { OCIMCPServer };
