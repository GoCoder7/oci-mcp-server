import * as oci from 'oci-sdk';
import { readFileSync } from 'fs';
import { OCIAuthConfig, OCIAuthConfigSchema } from '../types/oci';

export class OCIClientManager {
  private authConfig!: OCIAuthConfig;
  private provider!: any; // OCI provider type
  
  // Core clients
  public computeClient!: oci.core.ComputeClient;
  public virtualNetworkClient!: oci.core.VirtualNetworkClient;
  public blockstorageClient!: oci.core.BlockstorageClient;
  public objectStorageClient!: oci.objectstorage.ObjectStorageClient;
  public identityClient!: oci.identity.IdentityClient;
  
  // Database clients
  public databaseClient!: oci.database.DatabaseClient;
  
  // Monitoring clients
  public monitoringClient!: oci.monitoring.MonitoringClient;
  public loggingClient!: oci.logging.LoggingManagementClient;
  
  // Additional service clients
  public loadBalancerClient!: oci.loadbalancer.LoadBalancerClient;
  public networkLoadBalancerClient!: oci.networkloadbalancer.NetworkLoadBalancerClient;

  constructor(config?: Partial<OCIAuthConfig>) {
    this.initializeAuthConfig(config);
    this.initializeClients();
  }

  private initializeAuthConfig(config?: Partial<OCIAuthConfig>) {
    // Try to load from environment variables first
    const envConfig = {
      tenancyId: process.env.OCI_TENANCY_ID,
      userId: process.env.OCI_USER_ID,
      keyFingerprint: process.env.OCI_KEY_FINGERPRINT,
      privateKeyPath: process.env.OCI_PRIVATE_KEY_PATH,
      region: process.env.OCI_REGION,
      compartmentId: process.env.OCI_COMPARTMENT_ID
    };

    // Merge with provided config
    const mergedConfig = { ...envConfig, ...config };
    
    // Filter out undefined values
    const filteredConfig = Object.fromEntries(
      Object.entries(mergedConfig).filter(([_, value]) => value !== undefined)
    );

    // Validate configuration
    try {
      this.authConfig = OCIAuthConfigSchema.parse(filteredConfig);
    } catch (error) {
      throw new Error(`Invalid OCI configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Create authentication provider
    try {
      const privateKey = readFileSync(this.authConfig.privateKeyPath, 'utf8');
      
      this.provider = new oci.common.SimpleAuthenticationDetailsProvider(
        this.authConfig.tenancyId,
        this.authConfig.userId,
        this.authConfig.keyFingerprint,
        privateKey,
        null, // passphrase
        oci.common.Region.fromRegionId(this.authConfig.region)
      );
    } catch (error) {
      throw new Error(`Failed to create OCI authentication provider: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private initializeClients() {
    try {
      // Core compute and network clients
      this.computeClient = new oci.core.ComputeClient({ authenticationDetailsProvider: this.provider });
      this.virtualNetworkClient = new oci.core.VirtualNetworkClient({ authenticationDetailsProvider: this.provider });
      this.blockstorageClient = new oci.core.BlockstorageClient({ authenticationDetailsProvider: this.provider });
      this.identityClient = new oci.identity.IdentityClient({ authenticationDetailsProvider: this.provider });
      
      // Storage clients
      this.objectStorageClient = new oci.objectstorage.ObjectStorageClient({ authenticationDetailsProvider: this.provider });
      
      // Database clients
      this.databaseClient = new oci.database.DatabaseClient({ authenticationDetailsProvider: this.provider });
      
      // Monitoring clients
      this.monitoringClient = new oci.monitoring.MonitoringClient({ authenticationDetailsProvider: this.provider });
      this.loggingClient = new oci.logging.LoggingManagementClient({ authenticationDetailsProvider: this.provider });
      
      // Load balancer clients
      this.loadBalancerClient = new oci.loadbalancer.LoadBalancerClient({ authenticationDetailsProvider: this.provider });
      this.networkLoadBalancerClient = new oci.networkloadbalancer.NetworkLoadBalancerClient({ authenticationDetailsProvider: this.provider });
      
    } catch (error) {
      throw new Error(`Failed to initialize OCI clients: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Utility methods
  public getDefaultCompartmentId(): string {
    return this.authConfig.compartmentId || this.authConfig.tenancyId;
  }

  public getRegion(): string {
    return this.authConfig.region;
  }

  public getTenancyId(): string {
    return this.authConfig.tenancyId;
  }

  public async testConnection(): Promise<boolean> {
    try {
      const request = {
        compartmentId: this.getTenancyId()
      };
      await this.identityClient.listCompartments(request);
      return true;
    } catch (error) {
      console.error('OCI connection test failed:', error);
      return false;
    }
  }

  // Helper method to handle OCI API pagination
  public async getAllPages<T>(
    apiCall: (request: any) => Promise<{ items: T[]; opcNextPage?: string }>,
    request: any,
    maxItems = 1000
  ): Promise<T[]> {
    const allItems: T[] = [];
    let nextPage: string | undefined;
    
    do {
      const requestWithPage = nextPage ? { ...request, page: nextPage } : request;
      const response = await apiCall(requestWithPage);
      
      allItems.push(...response.items);
      nextPage = response.opcNextPage;
      
      // Safety check to prevent infinite loops
      if (allItems.length >= maxItems) {
        break;
      }
    } while (nextPage);
    
    return allItems;
  }

  // Error handling helper
  public handleOCIError(error: any): string {
    if (error.statusCode) {
      return `OCI API Error (${error.statusCode}): ${error.message || 'Unknown error'}`;
    }
    
    if (error.code) {
      return `OCI Error (${error.code}): ${error.message || 'Unknown error'}`;
    }
    
    return `OCI Error: ${error.message || error.toString()}`;
  }
}

// Singleton instance for reuse
let ociClientInstance: OCIClientManager | null = null;

export function getOCIClient(config?: Partial<OCIAuthConfig>): OCIClientManager {
  if (!ociClientInstance) {
    ociClientInstance = new OCIClientManager(config);
  }
  return ociClientInstance;
}

export function resetOCIClient(): void {
  ociClientInstance = null;
}
