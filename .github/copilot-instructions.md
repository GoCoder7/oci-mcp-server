# Copilot Instructions for OCI MCP Server

<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

## Project Context

This is a **Model Context Protocol (MCP) Server** for Oracle Cloud Infrastructure (OCI) integration. The project enables AI assistants to interact with OCI services through unified MCP tools.

## Technical Stack

- **Language**: TypeScript
- **Framework**: MCP SDK (@modelcontextprotocol/sdk)
- **Cloud SDK**: OCI SDK (oci-sdk)
- **Validation**: Zod for schema validation
- **Target**: Optimized for VS Code's 128-tool limit

## MCP Development Guidelines

You can find more info and examples at https://modelcontextprotocol.io/llms-full.txt

Additional SDK reference: https://github.com/modelcontextprotocol/create-python-server

## Code Style & Patterns

1. **Unified Tools**: Create consolidated tools that handle multiple related actions
2. **Type Safety**: Use TypeScript with strict typing and Zod validation
3. **Error Handling**: Comprehensive error handling with clear messages
4. **Documentation**: Include detailed JSDoc comments for all public APIs

## OCI Integration Patterns

1. **Authentication**: Use OCI config provider for authentication
2. **Service Clients**: Initialize OCI service clients per tool category
3. **Resource Management**: Follow OCI SDK patterns for resource lifecycle
4. **Region Handling**: Support multi-region operations where applicable

## Tool Categories

The project should implement **4 unified tools** to stay within VS Code limits:

1. **Compute Management** (`oci_compute_management`)
   - Instances, images, shapes, VNICs
   - Start, stop, restart, terminate operations
   - Instance monitoring and metrics

2. **Storage & Network** (`oci_storage_network`)
   - Block volumes, object storage, file systems
   - VCNs, subnets, security groups, load balancers
   - Network security and routing

3. **Database & Analytics** (`oci_database_analytics`)
   - Autonomous databases, MySQL, PostgreSQL
   - Analytics services, data science
   - Backup and recovery operations

4. **Monitoring & Security** (`oci_monitoring_security`)
   - CloudWatch metrics, logging, alarms
   - IAM policies, users, groups
   - Security assessments and compliance

## Best Practices

- Always validate inputs using Zod schemas
- Handle OCI API rate limits and retries
- Provide meaningful error messages with OCI error codes
- Support both OCID and name-based resource identification
- Include resource tags and metadata in responses
- Follow OCI naming conventions and constraints
