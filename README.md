# Oracle Cloud Infrastructure (OCI) MCP Server

A Model Context Protocol (MCP) server that provides access to Oracle Cloud Infrastructure services through a unified interface, optimized for VS Code integration.

## Features

### 🚀 Unified OCI Management Tool

**`oci-manage`** - Comprehensive OCI resource management
- **Compute**: Instances, volumes, shapes, images
- **Storage**: Object storage buckets and objects  
- **Network**: VCNs, subnets, security lists, gateways
- **Database**: DB systems, autonomous databases, backups
- **Monitoring**: Alarms, metrics, logs
- **Identity**: Users, groups, policies

## Quick Start

### 1. Installation

```bash
git clone https://github.com/GoCoder7/oci-mcp-server.git
cd oci-mcp-server
npm install
```

### 2. Build

```bash
npm run build
```

### 3. Configure OCI Authentication

Copy the example environment file and configure your OCI credentials:

```bash
cp .env.example .env
```

Edit `.env` with your OCI credentials:

```env
OCI_TENANCY_ID=ocid1.tenancy.oc1..aaaaaaaa...
OCI_USER_ID=ocid1.user.oc1..aaaaaaaa...
OCI_KEY_FINGERPRINT=aa:bb:cc:dd:ee:ff:gg:hh:ii:jj:kk:ll:mm:nn:oo:pp
OCI_PRIVATE_KEY_PATH=/path/to/your/oci_api_key.pem
OCI_REGION=us-ashburn-1
OCI_COMPARTMENT_ID=ocid1.compartment.oc1..aaaaaaaa... (optional)
```

### 4. VS Code Integration

Add to your VS Code `settings.json`:

```json
{
  "mcp.servers": {
    "oci-mcp-server": {
      "command": "node",
      "args": ["/path/to/oci-mcp-server/dist/simple-index.js"],
      "env": {
        "OCI_TENANCY_ID": "your-tenancy-id",
        "OCI_USER_ID": "your-user-id", 
        "OCI_KEY_FINGERPRINT": "your-key-fingerprint",
        "OCI_PRIVATE_KEY_PATH": "/path/to/your/oci_api_key.pem",
        "OCI_REGION": "us-ashburn-1"
      }
    }
  }
}
```

## Usage Examples

### List Compute Instances

```json
{
  "service": "compute",
  "action": "list",
  "resourceType": "instances",
  "compartmentId": "ocid1.compartment.oc1..aaaaaaaa..."
}
```

### Get Specific Instance Details

```json
{
  "service": "compute", 
  "action": "get",
  "resourceType": "instance",
  "resourceId": "ocid1.instance.oc1.iad.aaaaaaaa..."
}
```

### Create Object Storage Bucket

```json
{
  "service": "storage",
  "action": "create", 
  "resourceType": "bucket",
  "parameters": {
    "name": "my-new-bucket",
    "compartmentId": "ocid1.compartment.oc1..aaaaaaaa..."
  }
}
```

### List VCNs

```json
{
  "service": "network",
  "action": "list",
  "resourceType": "vcns",
  "compartmentId": "ocid1.compartment.oc1..aaaaaaaa..."
}
```

### Monitor Database Performance

```json
{
  "service": "monitoring",
  "action": "list", 
  "resourceType": "metrics",
  "parameters": {
    "namespace": "oci_autonomous_database"
  }
}
```

## OCI Authentication Setup

### 1. Create API Key Pair

1. Log into OCI Console
2. Go to Profile → User Settings → API Keys  
3. Click "Add API Key"
4. Generate or upload a key pair
5. Save the private key file securely

### 2. Required Information

- **Tenancy OCID**: Found in Profile → Tenancy
- **User OCID**: Found in Profile → User Settings
- **Key Fingerprint**: Generated when creating API key
- **Private Key Path**: Location of your .pem file
- **Region**: Your preferred OCI region
- **Compartment OCID**: Optional default compartment

### 3. Set File Permissions

```bash
chmod 600 /path/to/your/oci_api_key.pem
```

## Available Services & Actions

### Services
- `compute` - Compute instances and volumes
- `storage` - Object storage buckets and objects
- `network` - VCNs, subnets, security
- `database` - Database systems and autonomous DBs
- `monitoring` - Alarms, metrics, logging
- `identity` - Users, groups, policies

### Actions  
- `list` - List resources of specified type
- `get` - Get details of specific resource
- `create` - Create new resource
- `update` - Update existing resource (where supported)
- `delete` - Delete resource (where supported)
- `start` - Start resource (instances, databases)
- `stop` - Stop resource (instances, databases)

### Resource Types

**Compute**: `instances`, `volumes`, `images`, `shapes`  
**Storage**: `buckets`, `objects`  
**Network**: `vcns`, `subnets`, `security-lists`, `gateways`  
**Database**: `db-systems`, `autonomous-databases`, `backups`  
**Monitoring**: `alarms`, `metrics`, `logs`  
**Identity**: `users`, `groups`, `policies`

## Development

### Project Structure
```
src/
├── simple-index.ts         # Main MCP server (simplified)
├── index.ts               # Full MCP server (advanced)
├── types/
│   └── oci.ts             # Type definitions
├── utils/
│   └── oci-client.ts      # OCI client management  
└── tools/
    ├── compute.ts         # Compute management
    ├── storage-network.ts # Storage & network
    ├── database-analytics.ts # Database & analytics
    └── monitoring-security.ts # Monitoring & security
```

### Available Scripts

- `npm run build` - Build the project
- `npm run dev` - Run in development mode
- `npm run watch` - Run with auto-reload
- `npm start` - Run compiled version

### Current Implementation

The server currently provides:
- ✅ MCP protocol integration
- ✅ OCI credential validation  
- ✅ VS Code tool interface
- ✅ Basic service structure
- 🚧 Full OCI SDK integration (in progress)

## Troubleshooting

### Common Issues

**Authentication Errors**
- Verify OCI credentials are correct
- Check private key file permissions (600)
- Ensure user has proper IAM policies

**Connection Issues**  
- Verify region is correct
- Check network connectivity to OCI
- Validate compartment access

**VS Code Integration**
- Ensure MCP extension is installed
- Check server configuration in settings.json
- Verify file paths are absolute

### Error Messages

**"OCI credentials not configured"**
- Set required environment variables
- Check .env file or VS Code settings

**"Cannot use import statement outside a module"**  
- Ensure package.json has `"type": "module"`
- Verify build completed successfully

## Contributing

1. Fork the repository
2. Create feature branch
3. Make changes
4. Add tests if applicable  
5. Submit pull request

## Security

- Never commit `.env` files or private keys
- Use IAM policies to limit permissions
- Regularly rotate API keys
- Monitor OCI usage and costs

## License

MIT License - see LICENSE file for details

## Support

For issues:
1. Check troubleshooting section
2. Review OCI documentation
3. Open GitHub issue
4. Consult OCI community forums
