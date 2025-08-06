import { z } from 'zod';
import { getOCIClient } from '../utils/oci-client';
import { 
  OCIResourceListResponse, 
  OCIResourceDetailResponse, 
  OCIOperationResponse 
} from '../types/oci';

// Database & Analytics Tool Input Schemas
const DatabaseAnalyticsListInputSchema = z.object({
  action: z.literal('list'),
  resourceType: z.enum([
    'db-systems', 'databases', 'autonomous-databases', 'db-homes', 
    'db-nodes', 'backups', 'data-safe-targets', 'analytics-instances'
  ]),
  compartmentId: z.string().optional(),
  dbSystemId: z.string().optional(),    // For databases and db-homes
  dbHomeId: z.string().optional(),      // For databases
  limit: z.number().min(1).max(100).optional(),
  displayName: z.string().optional(),
  lifecycleState: z.string().optional()
});

const DatabaseAnalyticsGetInputSchema = z.object({
  action: z.literal('get'),
  resourceType: z.enum([
    'db-system', 'database', 'autonomous-database', 'db-home', 
    'backup', 'data-safe-target', 'analytics-instance'
  ]),
  resourceId: z.string().min(1, "Resource ID is required")
});

const DatabaseAnalyticsCreateInputSchema = z.object({
  action: z.literal('create'),
  resourceType: z.enum(['autonomous-database', 'database', 'backup']),
  data: z.union([
    // Autonomous Database
    z.object({
      compartmentId: z.string().min(1),
      dbName: z.string().min(1),
      cpuCoreCount: z.number().min(1),
      dataStorageSizeInTBs: z.number().min(1),
      adminPassword: z.string().min(12),
      displayName: z.string().optional(),
      dbVersion: z.string().optional(),
      dbWorkload: z.enum(['OLTP', 'DW']).optional(),
      isAutoScalingEnabled: z.boolean().optional(),
      isFreeTier: z.boolean().optional(),
      licenseModel: z.enum(['LICENSE_INCLUDED', 'BRING_YOUR_OWN_LICENSE']).optional(),
      subnetId: z.string().optional(),
      nsgIds: z.array(z.string()).optional()
    }),
    // Regular Database
    z.object({
      dbSystemId: z.string().min(1),
      dbName: z.string().min(1),
      adminPassword: z.string().min(12),
      dbVersion: z.string().optional(),
      characterSet: z.string().optional(),
      ncharacterSet: z.string().optional(),
      pdbName: z.string().optional()
    }),
    // Database Backup
    z.object({
      databaseId: z.string().min(1),
      displayName: z.string().min(1),
      type: z.enum(['INCREMENTAL', 'FULL']).optional()
    })
  ])
});

const DatabaseAnalyticsManageInputSchema = z.object({
  action: z.enum([
    'start-database', 'stop-database', 'restart-database',
    'start-autonomous-db', 'stop-autonomous-db', 'scale-autonomous-db',
    'restore-database', 'clone-database', 'delete-backup'
  ]),
  resourceType: z.enum(['database', 'autonomous-database', 'backup']),
  resourceId: z.string().min(1, "Resource ID is required"),
  // Scaling parameters for Autonomous DB
  cpuCoreCount: z.number().optional(),
  dataStorageSizeInTBs: z.number().optional(),
  // Restore parameters
  timestamp: z.string().optional(),
  backupId: z.string().optional(),
  // Clone parameters
  cloneName: z.string().optional(),
  targetCompartmentId: z.string().optional()
});

export const DatabaseAnalyticsToolInputSchema = z.union([
  DatabaseAnalyticsListInputSchema,
  DatabaseAnalyticsGetInputSchema,
  DatabaseAnalyticsCreateInputSchema,
  DatabaseAnalyticsManageInputSchema
]);

export type DatabaseAnalyticsToolInput = z.infer<typeof DatabaseAnalyticsToolInputSchema>;

export class DatabaseAnalyticsManager {
  private ociClient = getOCIClient();

  async execute(input: DatabaseAnalyticsToolInput): Promise<OCIResourceListResponse | OCIResourceDetailResponse | OCIOperationResponse> {
    try {
      switch (input.action) {
        case 'list':
          return await this.listResources(input);
        case 'get':
          return await this.getResource(input);
        case 'create':
          return await this.createResource(input);
        case 'start-database':
        case 'stop-database':
        case 'restart-database':
        case 'start-autonomous-db':
        case 'stop-autonomous-db':
        case 'scale-autonomous-db':
        case 'restore-database':
        case 'clone-database':
        case 'delete-backup':
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

  private async listResources(input: DatabaseAnalyticsListInputSchema['_type']): Promise<OCIResourceListResponse> {
    const compartmentId = input.compartmentId || this.ociClient.getDefaultCompartmentId();
    
    switch (input.resourceType) {
      case 'db-systems':
        const dbSystemsRequest = {
          compartmentId,
          limit: input.limit || 50,
          displayName: input.displayName,
          lifecycleState: input.lifecycleState
        };
        
        const dbSystemsResponse = await this.ociClient.databaseClient.listDbSystems(dbSystemsRequest);
        return {
          success: true,
          data: dbSystemsResponse.items,
          count: dbSystemsResponse.items.length,
          message: `Found ${dbSystemsResponse.items.length} DB systems`
        };

      case 'autonomous-databases':
        const adbRequest = {
          compartmentId,
          limit: input.limit || 50,
          displayName: input.displayName,
          lifecycleState: input.lifecycleState
        };
        
        const adbResponse = await this.ociClient.databaseClient.listAutonomousDatabases(adbRequest);
        return {
          success: true,
          data: adbResponse.items,
          count: adbResponse.items.length,
          message: `Found ${adbResponse.items.length} autonomous databases`
        };

      case 'databases':
        if (!input.dbSystemId && !input.dbHomeId) {
          throw new Error('Either dbSystemId or dbHomeId is required for listing databases');
        }
        
        const databasesRequest = input.dbSystemId 
          ? { compartmentId, dbSystemId: input.dbSystemId, limit: input.limit || 50 }
          : { compartmentId, dbHomeId: input.dbHomeId, limit: input.limit || 50 };
        
        const databasesResponse = await this.ociClient.databaseClient.listDatabases(databasesRequest);
        return {
          success: true,
          data: databasesResponse.items,
          count: databasesResponse.items.length,
          message: `Found ${databasesResponse.items.length} databases`
        };

      case 'db-homes':
        if (!input.dbSystemId) {
          throw new Error('dbSystemId is required for listing DB homes');
        }
        
        const dbHomesRequest = {
          compartmentId,
          dbSystemId: input.dbSystemId,
          limit: input.limit || 50,
          displayName: input.displayName,
          lifecycleState: input.lifecycleState
        };
        
        const dbHomesResponse = await this.ociClient.databaseClient.listDbHomes(dbHomesRequest);
        return {
          success: true,
          data: dbHomesResponse.items,
          count: dbHomesResponse.items.length,
          message: `Found ${dbHomesResponse.items.length} DB homes`
        };

      case 'db-nodes':
        if (!input.dbSystemId) {
          throw new Error('dbSystemId is required for listing DB nodes');
        }
        
        const dbNodesRequest = {
          compartmentId,
          dbSystemId: input.dbSystemId,
          limit: input.limit || 50,
          lifecycleState: input.lifecycleState
        };
        
        const dbNodesResponse = await this.ociClient.databaseClient.listDbNodes(dbNodesRequest);
        return {
          success: true,
          data: dbNodesResponse.items,
          count: dbNodesResponse.items.length,
          message: `Found ${dbNodesResponse.items.length} DB nodes`
        };

      case 'backups':
        const backupsRequest = {
          compartmentId,
          limit: input.limit || 50,
          lifecycleState: input.lifecycleState
        };
        
        const backupsResponse = await this.ociClient.databaseClient.listBackups(backupsRequest);
        return {
          success: true,
          data: backupsResponse.items,
          count: backupsResponse.items.length,
          message: `Found ${backupsResponse.items.length} database backups`
        };

      default:
        throw new Error(`Unsupported resource type: ${input.resourceType}`);
    }
  }

  private async getResource(input: DatabaseAnalyticsGetInputSchema['_type']): Promise<OCIResourceDetailResponse> {
    switch (input.resourceType) {
      case 'db-system':
        const dbSystemResponse = await this.ociClient.databaseClient.getDbSystem({
          dbSystemId: input.resourceId
        });
        
        return {
          success: true,
          data: dbSystemResponse.dbSystem,
          message: `Retrieved DB system details for ${input.resourceId}`
        };

      case 'autonomous-database':
        const adbResponse = await this.ociClient.databaseClient.getAutonomousDatabase({
          autonomousDatabaseId: input.resourceId
        });
        
        return {
          success: true,
          data: adbResponse.autonomousDatabase,
          message: `Retrieved autonomous database details for ${input.resourceId}`
        };

      case 'database':
        const databaseResponse = await this.ociClient.databaseClient.getDatabase({
          databaseId: input.resourceId
        });
        
        return {
          success: true,
          data: databaseResponse.database,
          message: `Retrieved database details for ${input.resourceId}`
        };

      case 'db-home':
        const dbHomeResponse = await this.ociClient.databaseClient.getDbHome({
          dbHomeId: input.resourceId
        });
        
        return {
          success: true,
          data: dbHomeResponse.dbHome,
          message: `Retrieved DB home details for ${input.resourceId}`
        };

      case 'backup':
        const backupResponse = await this.ociClient.databaseClient.getBackup({
          backupId: input.resourceId
        });
        
        return {
          success: true,
          data: backupResponse.backup,
          message: `Retrieved backup details for ${input.resourceId}`
        };

      default:
        throw new Error(`Unsupported resource type: ${input.resourceType}`);
    }
  }

  private async createResource(input: DatabaseAnalyticsCreateInputSchema['_type']): Promise<OCIOperationResponse> {
    switch (input.resourceType) {
      case 'autonomous-database':
        const adbData = input.data as any;
        const createAdbRequest = {
          createAutonomousDatabaseDetails: {
            compartmentId: adbData.compartmentId,
            dbName: adbData.dbName,
            cpuCoreCount: adbData.cpuCoreCount,
            dataStorageSizeInTBs: adbData.dataStorageSizeInTBs,
            adminPassword: adbData.adminPassword,
            displayName: adbData.displayName || adbData.dbName,
            dbVersion: adbData.dbVersion,
            dbWorkload: adbData.dbWorkload || 'OLTP',
            isAutoScalingEnabled: adbData.isAutoScalingEnabled || false,
            isFreeTier: adbData.isFreeTier || false,
            licenseModel: adbData.licenseModel || 'LICENSE_INCLUDED',
            subnetId: adbData.subnetId,
            nsgIds: adbData.nsgIds
          }
        };

        const adbResult = await this.ociClient.databaseClient.createAutonomousDatabase(createAdbRequest);
        
        return {
          success: true,
          data: adbResult.autonomousDatabase,
          message: `Autonomous database creation initiated: ${adbResult.autonomousDatabase.displayName}`,
          operationId: adbResult.autonomousDatabase.id
        };

      case 'database':
        const dbData = input.data as any;
        const createDbRequest = {
          createDatabaseDetails: {
            dbName: dbData.dbName,
            adminPassword: dbData.adminPassword,
            dbVersion: dbData.dbVersion,
            characterSet: dbData.characterSet || 'AL32UTF8',
            ncharacterSet: dbData.ncharacterSet || 'AL16UTF16',
            pdbName: dbData.pdbName
          },
          dbHomeId: dbData.dbSystemId // This should be dbHomeId in practice
        };

        const dbResult = await this.ociClient.databaseClient.createDatabase(createDbRequest);
        
        return {
          success: true,
          data: dbResult.database,
          message: `Database creation initiated: ${dbResult.database.dbName}`,
          operationId: dbResult.database.id
        };

      case 'backup':
        const backupData = input.data as any;
        const createBackupRequest = {
          createBackupDetails: {
            databaseId: backupData.databaseId,
            displayName: backupData.displayName,
            type: backupData.type || 'INCREMENTAL'
          }
        };

        const backupResult = await this.ociClient.databaseClient.createBackup(createBackupRequest);
        
        return {
          success: true,
          data: backupResult.backup,
          message: `Database backup creation initiated: ${backupResult.backup.displayName}`,
          operationId: backupResult.backup.id
        };

      default:
        throw new Error(`Unsupported resource type: ${input.resourceType}`);
    }
  }

  private async manageResource(input: DatabaseAnalyticsManageInputSchema['_type']): Promise<OCIOperationResponse> {
    switch (input.action) {
      case 'start-autonomous-db':
        const startAdbRequest = {
          autonomousDatabaseId: input.resourceId
        };
        
        const startAdbResult = await this.ociClient.databaseClient.startAutonomousDatabase(startAdbRequest);
        
        return {
          success: true,
          data: startAdbResult.autonomousDatabase,
          message: `Autonomous database start initiated: ${input.resourceId}`,
          operationId: input.resourceId
        };

      case 'stop-autonomous-db':
        const stopAdbRequest = {
          autonomousDatabaseId: input.resourceId
        };
        
        const stopAdbResult = await this.ociClient.databaseClient.stopAutonomousDatabase(stopAdbRequest);
        
        return {
          success: true,
          data: stopAdbResult.autonomousDatabase,
          message: `Autonomous database stop initiated: ${input.resourceId}`,
          operationId: input.resourceId
        };

      case 'scale-autonomous-db':
        if (!input.cpuCoreCount && !input.dataStorageSizeInTBs) {
          throw new Error('Either cpuCoreCount or dataStorageSizeInTBs is required for scaling');
        }
        
        const scaleAdbRequest = {
          autonomousDatabaseId: input.resourceId,
          updateAutonomousDatabaseDetails: {
            cpuCoreCount: input.cpuCoreCount,
            dataStorageSizeInTBs: input.dataStorageSizeInTBs
          }
        };

        const scaleAdbResult = await this.ociClient.databaseClient.updateAutonomousDatabase(scaleAdbRequest);
        
        return {
          success: true,
          data: scaleAdbResult.autonomousDatabase,
          message: `Autonomous database scaling initiated: ${input.resourceId}`,
          operationId: input.resourceId
        };

      case 'clone-database':
        if (input.resourceType === 'autonomous-database') {
          const cloneAdbRequest = {
            createAutonomousDatabaseCloneDetails: {
              sourceId: input.resourceId,
              cloneType: 'FULL',
              displayName: input.cloneName || `clone-${Date.now()}`,
              compartmentId: input.targetCompartmentId || this.ociClient.getDefaultCompartmentId()
            }
          };

          const cloneAdbResult = await this.ociClient.databaseClient.createAutonomousDatabaseClone(cloneAdbRequest);
          
          return {
            success: true,
            data: cloneAdbResult.autonomousDatabase,
            message: `Autonomous database clone initiated: ${cloneAdbResult.autonomousDatabase.displayName}`,
            operationId: cloneAdbResult.autonomousDatabase.id
          };
        }
        throw new Error('Clone operation only supported for autonomous databases');

      case 'delete-backup':
        const deleteBackupRequest = {
          backupId: input.resourceId
        };

        await this.ociClient.databaseClient.deleteBackup(deleteBackupRequest);
        
        return {
          success: true,
          message: `Backup deletion initiated: ${input.resourceId}`,
          operationId: input.resourceId
        };

      default:
        throw new Error(`Unsupported management action: ${input.action}`);
    }
  }
}
