import { z } from 'zod';
import { getOCIClient } from '../utils/oci-client';
import { 
  OCIResourceListResponse, 
  OCIResourceDetailResponse, 
  OCIOperationResponse,
  CreateBucketRequestSchema 
} from '../types/oci';

// Storage & Network Tool Input Schemas
const StorageNetworkListInputSchema = z.object({
  action: z.literal('list'),
  resourceType: z.enum([
    'buckets', 'objects', 'vcns', 'subnets', 'security-lists', 
    'route-tables', 'internet-gateways', 'nat-gateways', 'load-balancers'
  ]),
  compartmentId: z.string().optional(),
  namespaceName: z.string().optional(), // For object storage
  bucketName: z.string().optional(),     // For listing objects
  vcnId: z.string().optional(),          // For network resources
  limit: z.number().min(1).max(100).optional(),
  displayName: z.string().optional()
});

const StorageNetworkGetInputSchema = z.object({
  action: z.literal('get'),
  resourceType: z.enum([
    'bucket', 'object', 'vcn', 'subnet', 'security-list', 
    'route-table', 'internet-gateway', 'nat-gateway', 'load-balancer'
  ]),
  resourceId: z.string().min(1, "Resource ID is required"),
  namespaceName: z.string().optional(), // For object storage
  bucketName: z.string().optional(),     // For object operations
  objectName: z.string().optional()      // For object operations
});

const StorageNetworkCreateInputSchema = z.object({
  action: z.literal('create'),
  resourceType: z.enum(['bucket', 'vcn', 'subnet', 'security-list', 'route-table', 'internet-gateway', 'nat-gateway']),
  data: z.union([
    CreateBucketRequestSchema,
    z.object({
      // VCN creation
      compartmentId: z.string().min(1),
      cidrBlock: z.string().min(1),
      displayName: z.string().optional(),
      dnsLabel: z.string().optional()
    }),
    z.object({
      // Subnet creation
      compartmentId: z.string().min(1),
      vcnId: z.string().min(1),
      cidrBlock: z.string().min(1),
      availabilityDomain: z.string().optional(),
      displayName: z.string().optional(),
      routeTableId: z.string().optional(),
      securityListIds: z.array(z.string()).optional(),
      prohibitPublicIpOnVnic: z.boolean().optional()
    }),
    z.object({
      // Gateway creation
      compartmentId: z.string().min(1),
      vcnId: z.string().min(1),
      displayName: z.string().optional(),
      isEnabled: z.boolean().optional()
    })
  ])
});

const StorageNetworkManageInputSchema = z.object({
  action: z.enum(['upload-object', 'download-object', 'delete-object', 'delete-bucket', 'delete-vcn', 'update-security-list']),
  resourceType: z.enum(['object', 'bucket', 'vcn', 'security-list']),
  resourceId: z.string().optional(),
  namespaceName: z.string().optional(),
  bucketName: z.string().optional(),
  objectName: z.string().optional(),
  objectContent: z.string().optional(),      // For object upload
  contentType: z.string().optional(),        // For object upload
  securityRules: z.array(z.object({          // For security list updates
    direction: z.enum(['ingress', 'egress']),
    protocol: z.string(),
    source: z.string().optional(),
    destination: z.string().optional(),
    isStateless: z.boolean().optional()
  })).optional()
});

export const StorageNetworkToolInputSchema = z.union([
  StorageNetworkListInputSchema,
  StorageNetworkGetInputSchema,
  StorageNetworkCreateInputSchema,
  StorageNetworkManageInputSchema
]);

export type StorageNetworkToolInput = z.infer<typeof StorageNetworkToolInputSchema>;

export class StorageNetworkManager {
  private ociClient = getOCIClient();

  async execute(input: StorageNetworkToolInput): Promise<OCIResourceListResponse | OCIResourceDetailResponse | OCIOperationResponse> {
    try {
      switch (input.action) {
        case 'list':
          return await this.listResources(input);
        case 'get':
          return await this.getResource(input);
        case 'create':
          return await this.createResource(input);
        case 'upload-object':
        case 'download-object':
        case 'delete-object':
          return await this.manageObject(input);
        case 'delete-bucket':
        case 'delete-vcn':
        case 'update-security-list':
          return await this.manageResource(input);
        default:
          throw new Error(`Unsupported action: ${(input as any).action}`);
      }
    } catch (error) {
      const errorMessage = this.ociClient.handleOCIError(error);
      return {
        success: false,
        message: errorMessage
      };
    }
  }

  private async listResources(input: StorageNetworkListInputSchema['_type']): Promise<OCIResourceListResponse> {
    const compartmentId = input.compartmentId || this.ociClient.getDefaultCompartmentId();
    
    switch (input.resourceType) {
      case 'buckets':
        const namespaceName = input.namespaceName || await this.getNamespace();
        const bucketsRequest = {
          namespaceName,
          compartmentId,
          limit: input.limit || 50
        };
        
        const bucketsResponse = await this.ociClient.objectStorageClient.listBuckets(bucketsRequest);
        return {
          success: true,
          data: bucketsResponse.items,
          count: bucketsResponse.items.length,
          message: `Found ${bucketsResponse.items.length} buckets`
        };

      case 'objects':
        if (!input.bucketName) {
          throw new Error('Bucket name is required for listing objects');
        }
        
        const objectsNamespace = input.namespaceName || await this.getNamespace();
        const objectsRequest = {
          namespaceName: objectsNamespace,
          bucketName: input.bucketName,
          limit: input.limit || 50
        };
        
        const objectsResponse = await this.ociClient.objectStorageClient.listObjects(objectsRequest);
        return {
          success: true,
          data: objectsResponse.listObjects.objects || [],
          count: objectsResponse.listObjects.objects?.length || 0,
          message: `Found ${objectsResponse.listObjects.objects?.length || 0} objects in bucket ${input.bucketName}`
        };

      case 'vcns':
        const vcnsRequest = {
          compartmentId,
          limit: input.limit || 50,
          displayName: input.displayName
        };
        
        const vcnsResponse = await this.ociClient.virtualNetworkClient.listVcns(vcnsRequest);
        return {
          success: true,
          data: vcnsResponse.items,
          count: vcnsResponse.items.length,
          message: `Found ${vcnsResponse.items.length} VCNs`
        };

      case 'subnets':
        const subnetsRequest = {
          compartmentId,
          vcnId: input.vcnId,
          limit: input.limit || 50,
          displayName: input.displayName
        };
        
        const subnetsResponse = await this.ociClient.virtualNetworkClient.listSubnets(subnetsRequest);
        return {
          success: true,
          data: subnetsResponse.items,
          count: subnetsResponse.items.length,
          message: `Found ${subnetsResponse.items.length} subnets`
        };

      case 'security-lists':
        const securityListsRequest = {
          compartmentId,
          vcnId: input.vcnId,
          limit: input.limit || 50,
          displayName: input.displayName
        };
        
        const securityListsResponse = await this.ociClient.virtualNetworkClient.listSecurityLists(securityListsRequest);
        return {
          success: true,
          data: securityListsResponse.items,
          count: securityListsResponse.items.length,
          message: `Found ${securityListsResponse.items.length} security lists`
        };

      case 'route-tables':
        const routeTablesRequest = {
          compartmentId,
          vcnId: input.vcnId,
          limit: input.limit || 50,
          displayName: input.displayName
        };
        
        const routeTablesResponse = await this.ociClient.virtualNetworkClient.listRouteTables(routeTablesRequest);
        return {
          success: true,
          data: routeTablesResponse.items,
          count: routeTablesResponse.items.length,
          message: `Found ${routeTablesResponse.items.length} route tables`
        };

      case 'internet-gateways':
        const igwRequest = {
          compartmentId,
          vcnId: input.vcnId,
          limit: input.limit || 50,
          displayName: input.displayName
        };
        
        const igwResponse = await this.ociClient.virtualNetworkClient.listInternetGateways(igwRequest);
        return {
          success: true,
          data: igwResponse.items,
          count: igwResponse.items.length,
          message: `Found ${igwResponse.items.length} internet gateways`
        };

      case 'nat-gateways':
        const natGwRequest = {
          compartmentId,
          vcnId: input.vcnId,
          limit: input.limit || 50,
          displayName: input.displayName
        };
        
        const natGwResponse = await this.ociClient.virtualNetworkClient.listNatGateways(natGwRequest);
        return {
          success: true,
          data: natGwResponse.items,
          count: natGwResponse.items.length,
          message: `Found ${natGwResponse.items.length} NAT gateways`
        };

      case 'load-balancers':
        const lbRequest = {
          compartmentId,
          limit: input.limit || 50,
          displayName: input.displayName
        };
        
        const lbResponse = await this.ociClient.loadBalancerClient.listLoadBalancers(lbRequest);
        return {
          success: true,
          data: lbResponse.items,
          count: lbResponse.items.length,
          message: `Found ${lbResponse.items.length} load balancers`
        };

      default:
        throw new Error(`Unsupported resource type: ${input.resourceType}`);
    }
  }

  private async getResource(input: StorageNetworkGetInputSchema['_type']): Promise<OCIResourceDetailResponse> {
    switch (input.resourceType) {
      case 'bucket':
        const namespaceName = input.namespaceName || await this.getNamespace();
        const bucketResponse = await this.ociClient.objectStorageClient.getBucket({
          namespaceName,
          bucketName: input.resourceId
        });
        
        return {
          success: true,
          data: bucketResponse.bucket,
          message: `Retrieved bucket details for ${input.resourceId}`
        };

      case 'object':
        if (!input.bucketName || !input.objectName) {
          throw new Error('Bucket name and object name are required');
        }
        
        const objectNamespace = input.namespaceName || await this.getNamespace();
        const objectResponse = await this.ociClient.objectStorageClient.getObject({
          namespaceName: objectNamespace,
          bucketName: input.bucketName,
          objectName: input.objectName
        });
        
        return {
          success: true,
          data: {
            objectName: input.objectName,
            contentLength: objectResponse.contentLength,
            contentType: objectResponse.contentType,
            etag: objectResponse.etag,
            lastModified: objectResponse.lastModified
          },
          message: `Retrieved object details for ${input.objectName}`
        };

      case 'vcn':
        const vcnResponse = await this.ociClient.virtualNetworkClient.getVcn({
          vcnId: input.resourceId
        });
        
        return {
          success: true,
          data: vcnResponse.vcn,
          message: `Retrieved VCN details for ${input.resourceId}`
        };

      case 'subnet':
        const subnetResponse = await this.ociClient.virtualNetworkClient.getSubnet({
          subnetId: input.resourceId
        });
        
        return {
          success: true,
          data: subnetResponse.subnet,
          message: `Retrieved subnet details for ${input.resourceId}`
        };

      case 'security-list':
        const securityListResponse = await this.ociClient.virtualNetworkClient.getSecurityList({
          securityListId: input.resourceId
        });
        
        return {
          success: true,
          data: securityListResponse.securityList,
          message: `Retrieved security list details for ${input.resourceId}`
        };

      default:
        throw new Error(`Unsupported resource type: ${input.resourceType}`);
    }
  }

  private async createResource(input: StorageNetworkCreateInputSchema['_type']): Promise<OCIOperationResponse> {
    switch (input.resourceType) {
      case 'bucket':
        const bucketData = input.data as CreateBucketRequestSchema['_type'];
        const createBucketRequest = {
          namespaceName: bucketData.namespace,
          createBucketDetails: {
            name: bucketData.name,
            compartmentId: bucketData.compartmentId,
            storageTier: bucketData.storageTier || 'Standard',
            publicAccessType: bucketData.publicAccessType || 'NoPublicAccess'
          }
        };

        const bucketResult = await this.ociClient.objectStorageClient.createBucket(createBucketRequest);
        
        return {
          success: true,
          data: bucketResult.bucket,
          message: `Bucket created successfully: ${bucketData.name}`,
          operationId: bucketData.name
        };

      case 'vcn':
        const vcnData = input.data as any;
        const createVcnRequest = {
          createVcnDetails: {
            compartmentId: vcnData.compartmentId,
            cidrBlock: vcnData.cidrBlock,
            displayName: vcnData.displayName || `vcn-${Date.now()}`,
            dnsLabel: vcnData.dnsLabel
          }
        };

        const vcnResult = await this.ociClient.virtualNetworkClient.createVcn(createVcnRequest);
        
        return {
          success: true,
          data: vcnResult.vcn,
          message: `VCN created successfully: ${vcnResult.vcn.displayName}`,
          operationId: vcnResult.vcn.id
        };

      case 'subnet':
        const subnetData = input.data as any;
        const createSubnetRequest = {
          createSubnetDetails: {
            compartmentId: subnetData.compartmentId,
            vcnId: subnetData.vcnId,
            cidrBlock: subnetData.cidrBlock,
            availabilityDomain: subnetData.availabilityDomain,
            displayName: subnetData.displayName || `subnet-${Date.now()}`,
            routeTableId: subnetData.routeTableId,
            securityListIds: subnetData.securityListIds,
            prohibitPublicIpOnVnic: subnetData.prohibitPublicIpOnVnic
          }
        };

        const subnetResult = await this.ociClient.virtualNetworkClient.createSubnet(createSubnetRequest);
        
        return {
          success: true,
          data: subnetResult.subnet,
          message: `Subnet created successfully: ${subnetResult.subnet.displayName}`,
          operationId: subnetResult.subnet.id
        };

      case 'internet-gateway':
        const igwData = input.data as any;
        const createIgwRequest = {
          createInternetGatewayDetails: {
            compartmentId: igwData.compartmentId,
            vcnId: igwData.vcnId,
            displayName: igwData.displayName || `igw-${Date.now()}`,
            isEnabled: igwData.isEnabled !== false
          }
        };

        const igwResult = await this.ociClient.virtualNetworkClient.createInternetGateway(createIgwRequest);
        
        return {
          success: true,
          data: igwResult.internetGateway,
          message: `Internet Gateway created successfully: ${igwResult.internetGateway.displayName}`,
          operationId: igwResult.internetGateway.id
        };

      default:
        throw new Error(`Unsupported resource type: ${input.resourceType}`);
    }
  }

  private async manageObject(input: StorageNetworkManageInputSchema['_type']): Promise<OCIOperationResponse> {
    const namespaceName = input.namespaceName || await this.getNamespace();
    
    switch (input.action) {
      case 'upload-object':
        if (!input.bucketName || !input.objectName || !input.objectContent) {
          throw new Error('Bucket name, object name, and content are required for upload');
        }

        const uploadRequest = {
          namespaceName,
          bucketName: input.bucketName,
          objectName: input.objectName,
          putObjectBody: input.objectContent,
          contentType: input.contentType || 'application/octet-stream'
        };

        await this.ociClient.objectStorageClient.putObject(uploadRequest);
        
        return {
          success: true,
          message: `Object uploaded successfully: ${input.objectName}`,
          operationId: input.objectName
        };

      case 'delete-object':
        if (!input.bucketName || !input.objectName) {
          throw new Error('Bucket name and object name are required for deletion');
        }

        const deleteObjectRequest = {
          namespaceName,
          bucketName: input.bucketName,
          objectName: input.objectName
        };

        await this.ociClient.objectStorageClient.deleteObject(deleteObjectRequest);
        
        return {
          success: true,
          message: `Object deleted successfully: ${input.objectName}`,
          operationId: input.objectName
        };

      default:
        throw new Error(`Unsupported object action: ${input.action}`);
    }
  }

  private async manageResource(input: StorageNetworkManageInputSchema['_type']): Promise<OCIOperationResponse> {
    switch (input.action) {
      case 'delete-bucket':
        if (!input.bucketName) {
          throw new Error('Bucket name is required for deletion');
        }
        
        const namespaceName = input.namespaceName || await this.getNamespace();
        const deleteBucketRequest = {
          namespaceName,
          bucketName: input.bucketName
        };

        await this.ociClient.objectStorageClient.deleteBucket(deleteBucketRequest);
        
        return {
          success: true,
          message: `Bucket deleted successfully: ${input.bucketName}`,
          operationId: input.bucketName
        };

      case 'delete-vcn':
        if (!input.resourceId) {
          throw new Error('VCN ID is required for deletion');
        }

        const deleteVcnRequest = {
          vcnId: input.resourceId
        };

        await this.ociClient.virtualNetworkClient.deleteVcn(deleteVcnRequest);
        
        return {
          success: true,
          message: `VCN deletion initiated: ${input.resourceId}`,
          operationId: input.resourceId
        };

      default:
        throw new Error(`Unsupported management action: ${input.action}`);
    }
  }

  private async getNamespace(): Promise<string> {
    const response = await this.ociClient.objectStorageClient.getNamespace({});
    return response.value;
  }
}
