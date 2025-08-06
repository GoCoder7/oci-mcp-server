import { z } from 'zod';
import { getOCIClient } from '../utils/oci-client';
import { 
  OCIResourceListResponse, 
  OCIResourceDetailResponse, 
  OCIOperationResponse,
  OCIListQuerySchema,
  CreateInstanceRequestSchema 
} from '../types/oci';

// Compute Tool Input Schemas
const ComputeListInputSchema = z.object({
  action: z.literal('list'),
  resourceType: z.enum(['instances', 'images', 'shapes', 'volumes', 'volume-attachments']),
  compartmentId: z.string().optional(),
  availabilityDomain: z.string().optional(),
  limit: z.number().min(1).max(100).optional(),
  displayName: z.string().optional(),
  lifecycleState: z.string().optional()
});

const ComputeGetInputSchema = z.object({
  action: z.literal('get'),
  resourceType: z.enum(['instance', 'image', 'volume', 'volume-attachment']),
  resourceId: z.string().min(1, "Resource ID is required")
});

const ComputeCreateInputSchema = z.object({
  action: z.literal('create'),
  resourceType: z.enum(['instance', 'volume']),
  data: z.union([
    CreateInstanceRequestSchema,
    z.object({
      availabilityDomain: z.string().min(1, "Availability domain is required"),
      compartmentId: z.string().min(1, "Compartment ID is required"),
      sizeInGBs: z.number().min(50, "Volume size must be at least 50 GB"),
      displayName: z.string().optional(),
      volumeType: z.enum(['iscsi', 'paravirtualized']).optional()
    })
  ])
});

const ComputeManageInputSchema = z.object({
  action: z.enum(['start', 'stop', 'reboot', 'terminate', 'attach-volume', 'detach-volume']),
  resourceType: z.enum(['instance', 'volume']),
  resourceId: z.string().min(1, "Resource ID is required"),
  instanceId: z.string().optional(), // For volume operations
  volumeId: z.string().optional()     // For volume operations
});

export const ComputeToolInputSchema = z.union([
  ComputeListInputSchema,
  ComputeGetInputSchema,
  ComputeCreateInputSchema,
  ComputeManageInputSchema
]);

export type ComputeToolInput = z.infer<typeof ComputeToolInputSchema>;

export class ComputeManager {
  private ociClient = getOCIClient();

  async execute(input: ComputeToolInput): Promise<OCIResourceListResponse | OCIResourceDetailResponse | OCIOperationResponse> {
    try {
      switch (input.action) {
        case 'list':
          return await this.listResources(input);
        case 'get':
          return await this.getResource(input);
        case 'create':
          return await this.createResource(input);
        case 'start':
        case 'stop':
        case 'reboot':
        case 'terminate':
          return await this.manageInstance(input);
        case 'attach-volume':
        case 'detach-volume':
          return await this.manageVolume(input);
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

  private async listResources(input: z.infer<typeof ComputeListInputSchema>): Promise<OCIResourceListResponse> {
    const compartmentId = input.compartmentId || this.ociClient.getDefaultCompartmentId();
    
    switch (input.resourceType) {
      case 'instances':
        const instancesRequest = {
          compartmentId,
          availabilityDomain: input.availabilityDomain,
          limit: input.limit || 50,
          displayName: input.displayName,
          lifecycleState: input.lifecycleState
        };
        
        const instancesResponse = await this.ociClient.computeClient.listInstances(instancesRequest);
        return {
          success: true,
          data: instancesResponse.items,
          count: instancesResponse.items.length,
          message: `Found ${instancesResponse.items.length} compute instances`
        };

      case 'images':
        const imagesRequest = {
          compartmentId,
          limit: input.limit || 50,
          lifecycleState: input.lifecycleState
        };
        
        const imagesResponse = await this.ociClient.computeClient.listImages(imagesRequest);
        return {
          success: true,
          data: imagesResponse.items,
          count: imagesResponse.items.length,
          message: `Found ${imagesResponse.items.length} compute images`
        };

      case 'shapes':
        const shapesRequest = {
          compartmentId,
          availabilityDomain: input.availabilityDomain,
          limit: input.limit || 50
        };
        
        const shapesResponse = await this.ociClient.computeClient.listShapes(shapesRequest);
        return {
          success: true,
          data: shapesResponse.items,
          count: shapesResponse.items.length,
          message: `Found ${shapesResponse.items.length} compute shapes`
        };

      case 'volumes':
        const volumesRequest = {
          compartmentId,
          availabilityDomain: input.availabilityDomain,
          limit: input.limit || 50,
          displayName: input.displayName,
          lifecycleState: input.lifecycleState
        };
        
        const volumesResponse = await this.ociClient.blockstorageClient.listVolumes(volumesRequest);
        return {
          success: true,
          data: volumesResponse.items,
          count: volumesResponse.items.length,
          message: `Found ${volumesResponse.items.length} block volumes`
        };

      case 'volume-attachments':
        const attachmentsRequest = {
          compartmentId,
          availabilityDomain: input.availabilityDomain,
          limit: input.limit || 50
        };
        
        const attachmentsResponse = await this.ociClient.computeClient.listVolumeAttachments(attachmentsRequest);
        return {
          success: true,
          data: attachmentsResponse.items,
          count: attachmentsResponse.items.length,
          message: `Found ${attachmentsResponse.items.length} volume attachments`
        };

      default:
        throw new Error(`Unsupported resource type: ${input.resourceType}`);
    }
  }

  private async getResource(input: z.infer<typeof ComputeGetInputSchema>): Promise<OCIResourceDetailResponse> {
    switch (input.resourceType) {
      case 'instance':
        const instanceResponse = await this.ociClient.computeClient.getInstance({
          instanceId: input.resourceId
        });
        
        return {
          success: true,
          data: instanceResponse.instance,
          message: `Retrieved instance details for ${input.resourceId}`
        };

      case 'image':
        const imageResponse = await this.ociClient.computeClient.getImage({
          imageId: input.resourceId
        });
        
        return {
          success: true,
          data: imageResponse.image,
          message: `Retrieved image details for ${input.resourceId}`
        };

      case 'volume':
        const volumeResponse = await this.ociClient.blockstorageClient.getVolume({
          volumeId: input.resourceId
        });
        
        return {
          success: true,
          data: volumeResponse.volume,
          message: `Retrieved volume details for ${input.resourceId}`
        };

      case 'volume-attachment':
        const attachmentResponse = await this.ociClient.computeClient.getVolumeAttachment({
          volumeAttachmentId: input.resourceId
        });
        
        return {
          success: true,
          data: attachmentResponse.volumeAttachment,
          message: `Retrieved volume attachment details for ${input.resourceId}`
        };

      default:
        throw new Error(`Unsupported resource type: ${input.resourceType}`);
    }
  }

  private async createResource(input: z.infer<typeof ComputeCreateInputSchema>): Promise<OCIOperationResponse> {
    switch (input.resourceType) {
      case 'instance':
        const instanceData = input.data as z.infer<typeof CreateInstanceRequestSchema>;
        const createInstanceRequest = {
          launchInstanceDetails: {
            availabilityDomain: instanceData.availabilityDomain,
            compartmentId: instanceData.compartmentId,
            shape: instanceData.shape,
            displayName: instanceData.displayName || `instance-${Date.now()}`,
            sourceDetails: {
              sourceType: "image",
              imageId: instanceData.imageId
            },
            createVnicDetails: instanceData.subnetId ? {
              subnetId: instanceData.subnetId
            } : undefined,
            metadata: {
              ...instanceData.metadata,
              ...(instanceData.sshAuthorizedKeys ? { ssh_authorized_keys: instanceData.sshAuthorizedKeys.join('\n') } : {})
            }
          }
        };

        const instanceResult = await this.ociClient.computeClient.launchInstance(createInstanceRequest);
        
        return {
          success: true,
          data: instanceResult.instance,
          message: `Instance creation initiated: ${instanceResult.instance.displayName}`,
          operationId: instanceResult.instance.id
        };

      case 'volume':
        const volumeData = input.data as any; // Volume creation schema
        const createVolumeRequest = {
          createVolumeDetails: {
            availabilityDomain: volumeData.availabilityDomain,
            compartmentId: volumeData.compartmentId,
            sizeInGBs: volumeData.sizeInGBs,
            displayName: volumeData.displayName || `volume-${Date.now()}`,
            volumeType: volumeData.volumeType || 'iscsi'
          }
        };

        const volumeResult = await this.ociClient.blockstorageClient.createVolume(createVolumeRequest);
        
        return {
          success: true,
          data: volumeResult.volume,
          message: `Volume creation initiated: ${volumeResult.volume.displayName}`,
          operationId: volumeResult.volume.id
        };

      default:
        throw new Error(`Unsupported resource type: ${input.resourceType}`);
    }
  }

  private async manageInstance(input: ComputeManageInputSchema['_type']): Promise<OCIOperationResponse> {
    const request = { instanceId: input.resourceId };
    
    switch (input.action) {
      case 'start':
        const startResult = await this.ociClient.computeClient.instanceAction({
          ...request,
          action: 'START'
        });
        
        return {
          success: true,
          data: startResult.instance,
          message: `Instance start initiated: ${input.resourceId}`,
          operationId: input.resourceId
        };

      case 'stop':
        const stopResult = await this.ociClient.computeClient.instanceAction({
          ...request,
          action: 'STOP'
        });
        
        return {
          success: true,
          data: stopResult.instance,
          message: `Instance stop initiated: ${input.resourceId}`,
          operationId: input.resourceId
        };

      case 'reboot':
        const rebootResult = await this.ociClient.computeClient.instanceAction({
          ...request,
          action: 'RESET'
        });
        
        return {
          success: true,
          data: rebootResult.instance,
          message: `Instance reboot initiated: ${input.resourceId}`,
          operationId: input.resourceId
        };

      case 'terminate':
        const terminateResult = await this.ociClient.computeClient.terminateInstance(request);
        
        return {
          success: true,
          message: `Instance termination initiated: ${input.resourceId}`,
          operationId: input.resourceId
        };

      default:
        throw new Error(`Unsupported instance action: ${input.action}`);
    }
  }

  private async manageVolume(input: ComputeManageInputSchema['_type']): Promise<OCIOperationResponse> {
    switch (input.action) {
      case 'attach-volume':
        if (!input.instanceId || !input.volumeId) {
          throw new Error('Both instanceId and volumeId are required for volume attachment');
        }

        const attachRequest = {
          attachVolumeDetails: {
            instanceId: input.instanceId,
            type: 'iscsi',
            volumeId: input.volumeId
          }
        };

        const attachResult = await this.ociClient.computeClient.attachVolume(attachRequest);
        
        return {
          success: true,
          data: attachResult.volumeAttachment,
          message: `Volume attachment initiated: ${input.volumeId} to ${input.instanceId}`,
          operationId: attachResult.volumeAttachment.id
        };

      case 'detach-volume':
        const detachRequest = { volumeAttachmentId: input.resourceId };
        await this.ociClient.computeClient.detachVolume(detachRequest);
        
        return {
          success: true,
          message: `Volume detachment initiated: ${input.resourceId}`,
          operationId: input.resourceId
        };

      default:
        throw new Error(`Unsupported volume action: ${input.action}`);
    }
  }
}
