import { z } from 'zod';

// OCI Authentication Configuration
export const OCIAuthConfigSchema = z.object({
  tenancyId: z.string().min(1, "Tenancy ID is required"),
  userId: z.string().min(1, "User ID is required"),
  keyFingerprint: z.string().min(1, "Key fingerprint is required"),
  privateKeyPath: z.string().min(1, "Private key path is required"),
  region: z.string().min(1, "Region is required"),
  compartmentId: z.string().optional()
});

export type OCIAuthConfig = z.infer<typeof OCIAuthConfigSchema>;

// Common OCI Resource Schemas
export const OCIResourceBaseSchema = z.object({
  id: z.string(),
  displayName: z.string().optional(),
  timeCreated: z.string().optional(),
  lifecycleState: z.string().optional(),
  freeformTags: z.record(z.string()).optional(),
  definedTags: z.record(z.record(z.string())).optional()
});

// Compute Instance Schemas
export const ComputeInstanceSchema = OCIResourceBaseSchema.extend({
  shape: z.string(),
  availabilityDomain: z.string(),
  imageId: z.string().optional(),
  metadata: z.record(z.string()).optional(),
  agentConfig: z.object({
    isMonitoringDisabled: z.boolean().optional(),
    isManagementDisabled: z.boolean().optional()
  }).optional()
});

export const CreateInstanceRequestSchema = z.object({
  availabilityDomain: z.string().min(1, "Availability domain is required"),
  compartmentId: z.string().min(1, "Compartment ID is required"),
  shape: z.string().min(1, "Shape is required"),
  imageId: z.string().min(1, "Image ID is required"),
  displayName: z.string().optional(),
  metadata: z.record(z.string()).optional(),
  subnetId: z.string().optional(),
  sshAuthorizedKeys: z.array(z.string()).optional()
});

// Storage Schemas
export const BucketSchema = OCIResourceBaseSchema.extend({
  name: z.string(),
  namespace: z.string(),
  size: z.number().optional(),
  objectCount: z.number().optional(),
  storageTier: z.string().optional(),
  publicAccessType: z.string().optional()
});

export const CreateBucketRequestSchema = z.object({
  name: z.string().min(1, "Bucket name is required"),
  compartmentId: z.string().min(1, "Compartment ID is required"),
  namespace: z.string().min(1, "Namespace is required"),
  storageTier: z.enum(['Standard', 'InfrequentAccess', 'Archive']).optional(),
  publicAccessType: z.enum(['NoPublicAccess', 'ObjectRead', 'ObjectReadWithoutList']).optional()
});

export const VolumeSchema = OCIResourceBaseSchema.extend({
  sizeInGBs: z.number(),
  volumeGroupId: z.string().optional(),
  isHydrated: z.boolean().optional(),
  vpusPerGB: z.number().optional()
});

// Network Schemas
export const VCNSchema = OCIResourceBaseSchema.extend({
  cidrBlock: z.string(),
  dnsLabel: z.string().optional(),
  isIpv6Enabled: z.boolean().optional()
});

export const SubnetSchema = OCIResourceBaseSchema.extend({
  vcnId: z.string(),
  cidrBlock: z.string(),
  availabilityDomain: z.string().optional(),
  routeTableId: z.string().optional(),
  securityListIds: z.array(z.string()).optional(),
  dhcpOptionsId: z.string().optional(),
  prohibitPublicIpOnVnic: z.boolean().optional()
});

// Database Schemas
export const DatabaseSchema = OCIResourceBaseSchema.extend({
  dbName: z.string(),
  dbVersion: z.string(),
  pdbName: z.string().optional(),
  characterSet: z.string().optional(),
  ncharacterSet: z.string().optional(),
  dbBackupConfig: z.object({
    autoBackupEnabled: z.boolean().optional(),
    recoveryWindowInDays: z.number().optional()
  }).optional()
});

export const AutonomousDatabaseSchema = OCIResourceBaseSchema.extend({
  dbName: z.string(),
  cpuCoreCount: z.number(),
  dataStorageSizeInTBs: z.number(),
  dbVersion: z.string(),
  dbWorkload: z.enum(['OLTP', 'DW']),
  isAutoScalingEnabled: z.boolean().optional(),
  isFreeTier: z.boolean().optional(),
  licenseModel: z.enum(['LICENSE_INCLUDED', 'BRING_YOUR_OWN_LICENSE']).optional()
});

// Monitoring Schemas
export const MetricSchema = z.object({
  name: z.string(),
  namespace: z.string(),
  dimensions: z.record(z.string()).optional(),
  metadata: z.record(z.string()).optional()
});

export const AlarmSchema = OCIResourceBaseSchema.extend({
  metricCompartmentId: z.string(),
  namespace: z.string(),
  query: z.string(),
  severity: z.enum(['CRITICAL', 'ERROR', 'WARNING', 'INFO']),
  destinations: z.array(z.string()),
  isEnabled: z.boolean().optional(),
  repeatNotificationDuration: z.string().optional()
});

// Security Schemas
export const SecurityListSchema = OCIResourceBaseSchema.extend({
  vcnId: z.string(),
  egressSecurityRules: z.array(z.object({
    destination: z.string(),
    protocol: z.string(),
    destinationType: z.enum(['CIDR_BLOCK', 'SERVICE_CIDR_BLOCK']).optional(),
    isStateless: z.boolean().optional()
  })).optional(),
  ingressSecurityRules: z.array(z.object({
    source: z.string(),
    protocol: z.string(),
    sourceType: z.enum(['CIDR_BLOCK', 'SERVICE_CIDR_BLOCK']).optional(),
    isStateless: z.boolean().optional()
  })).optional()
});

// Tool Response Schemas
export const OCIResourceListResponseSchema = z.object({
  success: z.boolean(),
  data: z.array(z.record(z.any())),
  count: z.number(),
  message: z.string().optional(),
  nextPage: z.string().optional()
});

export const OCIResourceDetailResponseSchema = z.object({
  success: z.boolean(),
  data: z.record(z.any()),
  message: z.string().optional()
});

export const OCIOperationResponseSchema = z.object({
  success: z.boolean(),
  data: z.record(z.any()).optional(),
  message: z.string(),
  operationId: z.string().optional()
});

// Common Query Parameters
export const OCIListQuerySchema = z.object({
  compartmentId: z.string().optional(),
  limit: z.number().min(1).max(1000).optional(),
  page: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['ASC', 'DESC']).optional(),
  lifecycleState: z.string().optional(),
  displayName: z.string().optional()
});

export type OCIResourceListResponse = z.infer<typeof OCIResourceListResponseSchema>;
export type OCIResourceDetailResponse = z.infer<typeof OCIResourceDetailResponseSchema>;
export type OCIOperationResponse = z.infer<typeof OCIOperationResponseSchema>;
export type ComputeInstance = z.infer<typeof ComputeInstanceSchema>;
export type CreateInstanceRequest = z.infer<typeof CreateInstanceRequestSchema>;
export type Bucket = z.infer<typeof BucketSchema>;
export type CreateBucketRequest = z.infer<typeof CreateBucketRequestSchema>;
export type VCN = z.infer<typeof VCNSchema>;
export type Subnet = z.infer<typeof SubnetSchema>;
export type AutonomousDatabase = z.infer<typeof AutonomousDatabaseSchema>;
export type Alarm = z.infer<typeof AlarmSchema>;
export type SecurityList = z.infer<typeof SecurityListSchema>;
export type OCIListQuery = z.infer<typeof OCIListQuerySchema>;
