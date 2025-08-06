import { z } from 'zod';
import { getOCIClient } from '../utils/oci-client';
import { 
  OCIResourceListResponse, 
  OCIResourceDetailResponse, 
  OCIOperationResponse 
} from '../types/oci';

// Monitoring & Security Tool Input Schemas
const MonitoringSecurityListInputSchema = z.object({
  action: z.literal('list'),
  resourceType: z.enum([
    'alarms', 'metrics', 'metric-data', 'notifications', 'events', 
    'log-groups', 'logs', 'network-security-groups', 'security-lists',
    'vault-secrets', 'certificates', 'policies', 'users', 'groups'
  ]),
  compartmentId: z.string().optional(),
  metricNamespace: z.string().optional(),    // For metrics
  logGroupId: z.string().optional(),         // For logs
  vcnId: z.string().optional(),              // For network security
  vaultId: z.string().optional(),            // For secrets
  startTime: z.string().optional(),          // For metric data
  endTime: z.string().optional(),            // For metric data
  limit: z.number().min(1).max(100).optional(),
  displayName: z.string().optional()
});

const MonitoringSecurityGetInputSchema = z.object({
  action: z.literal('get'),
  resourceType: z.enum([
    'alarm', 'metric', 'notification-topic', 'log-group', 'log', 
    'network-security-group', 'security-list', 'vault', 'secret', 
    'certificate', 'policy', 'user', 'group'
  ]),
  resourceId: z.string().min(1, "Resource ID is required"),
  logGroupId: z.string().optional(),  // For log operations
  secretName: z.string().optional()   // For secret operations
});

const MonitoringSecurityCreateInputSchema = z.object({
  action: z.literal('create'),
  resourceType: z.enum([
    'alarm', 'notification-topic', 'log-group', 'network-security-group', 
    'vault', 'secret', 'policy', 'user', 'group'
  ]),
  data: z.union([
    // Alarm creation
    z.object({
      compartmentId: z.string().min(1),
      displayName: z.string().min(1),
      metricCompartmentId: z.string().min(1),
      namespace: z.string().min(1),
      query: z.string().min(1),
      severity: z.enum(['CRITICAL', 'ERROR', 'WARNING', 'INFO']),
      destinations: z.array(z.string()).min(1),
      isEnabled: z.boolean().optional(),
      body: z.string().optional(),
      pendingDuration: z.string().optional()
    }),
    // Notification Topic
    z.object({
      compartmentId: z.string().min(1),
      name: z.string().min(1),
      description: z.string().optional()
    }),
    // Log Group
    z.object({
      compartmentId: z.string().min(1),
      displayName: z.string().min(1),
      description: z.string().optional()
    }),
    // Network Security Group
    z.object({
      compartmentId: z.string().min(1),
      vcnId: z.string().min(1),
      displayName: z.string().min(1),
      securityRules: z.array(z.object({
        direction: z.enum(['INGRESS', 'EGRESS']),
        protocol: z.string(),
        source: z.string().optional(),
        destination: z.string().optional(),
        sourceType: z.string().optional(),
        destinationType: z.string().optional(),
        isStateless: z.boolean().optional()
      })).optional()
    }),
    // Vault
    z.object({
      compartmentId: z.string().min(1),
      displayName: z.string().min(1),
      vaultType: z.enum(['DEFAULT', 'VIRTUAL_PRIVATE']).optional()
    }),
    // User/Group/Policy
    z.object({
      compartmentId: z.string().min(1),
      name: z.string().min(1),
      description: z.string().min(1),
      statements: z.array(z.string()).optional(), // For policies
      email: z.string().email().optional(),       // For users
      members: z.array(z.string()).optional()     // For groups
    })
  ])
});

const MonitoringSecurityManageInputSchema = z.object({
  action: z.enum([
    'enable-alarm', 'disable-alarm', 'update-alarm', 'delete-alarm',
    'add-security-rule', 'remove-security-rule', 'update-secret',
    'rotate-secret', 'add-user-to-group', 'remove-user-from-group',
    'attach-policy', 'detach-policy'
  ]),
  resourceType: z.enum([
    'alarm', 'network-security-group', 'secret', 'group', 'policy'
  ]),
  resourceId: z.string().min(1, "Resource ID is required"),
  // Security rule parameters
  securityRule: z.object({
    direction: z.enum(['INGRESS', 'EGRESS']),
    protocol: z.string(),
    source: z.string().optional(),
    destination: z.string().optional(),
    isStateless: z.boolean().optional()
  }).optional(),
  // Secret parameters
  secretContent: z.string().optional(),
  // User/Group management
  userId: z.string().optional(),
  groupId: z.string().optional(),
  policyId: z.string().optional(),
  // Alarm update parameters
  query: z.string().optional(),
  severity: z.enum(['CRITICAL', 'ERROR', 'WARNING', 'INFO']).optional(),
  isEnabled: z.boolean().optional()
});

export const MonitoringSecurityToolInputSchema = z.union([
  MonitoringSecurityListInputSchema,
  MonitoringSecurityGetInputSchema,
  MonitoringSecurityCreateInputSchema,
  MonitoringSecurityManageInputSchema
]);

export type MonitoringSecurityToolInput = z.infer<typeof MonitoringSecurityToolInputSchema>;

export class MonitoringSecurityManager {
  private ociClient = getOCIClient();

  async execute(input: MonitoringSecurityToolInput): Promise<OCIResourceListResponse | OCIResourceDetailResponse | OCIOperationResponse> {
    try {
      switch (input.action) {
        case 'list':
          return await this.listResources(input);
        case 'get':
          return await this.getResource(input);
        case 'create':
          return await this.createResource(input);
        case 'enable-alarm':
        case 'disable-alarm':
        case 'update-alarm':
        case 'delete-alarm':
        case 'add-security-rule':
        case 'remove-security-rule':
        case 'update-secret':
        case 'rotate-secret':
        case 'add-user-to-group':
        case 'remove-user-from-group':
        case 'attach-policy':
        case 'detach-policy':
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

  private async listResources(input: MonitoringSecurityListInputSchema['_type']): Promise<OCIResourceListResponse> {
    const compartmentId = input.compartmentId || this.ociClient.getDefaultCompartmentId();
    
    switch (input.resourceType) {
      case 'alarms':
        const alarmsRequest = {
          compartmentId,
          limit: input.limit || 50,
          displayName: input.displayName
        };
        
        const alarmsResponse = await this.ociClient.monitoringClient.listAlarms(alarmsRequest);
        return {
          success: true,
          data: alarmsResponse.items,
          count: alarmsResponse.items.length,
          message: `Found ${alarmsResponse.items.length} alarms`
        };

      case 'metrics':
        if (!input.metricNamespace) {
          throw new Error('Metric namespace is required for listing metrics');
        }
        
        const metricsRequest = {
          compartmentId,
          namespace: input.metricNamespace,
          limit: input.limit || 50
        };
        
        const metricsResponse = await this.ociClient.monitoringClient.listMetrics(metricsRequest);
        return {
          success: true,
          data: metricsResponse.items,
          count: metricsResponse.items.length,
          message: `Found ${metricsResponse.items.length} metrics in namespace ${input.metricNamespace}`
        };

      case 'metric-data':
        if (!input.metricNamespace || !input.startTime || !input.endTime) {
          throw new Error('Metric namespace, start time, and end time are required for metric data');
        }
        
        const metricDataRequest = {
          compartmentId,
          query: `${input.metricNamespace}[]`,
          startTime: new Date(input.startTime),
          endTime: new Date(input.endTime)
        };
        
        const metricDataResponse = await this.ociClient.monitoringClient.summarizeMetricsData(metricDataRequest);
        return {
          success: true,
          data: metricDataResponse.items,
          count: metricDataResponse.items.length,
          message: `Retrieved metric data for ${input.metricNamespace}`
        };

      case 'log-groups':
        const logGroupsRequest = {
          compartmentId,
          limit: input.limit || 50,
          displayName: input.displayName
        };
        
        const logGroupsResponse = await this.ociClient.loggingClient.listLogGroups(logGroupsRequest);
        return {
          success: true,
          data: logGroupsResponse.items,
          count: logGroupsResponse.items.length,
          message: `Found ${logGroupsResponse.items.length} log groups`
        };

      case 'network-security-groups':
        const nsgRequest = {
          compartmentId,
          vcnId: input.vcnId,
          limit: input.limit || 50,
          displayName: input.displayName
        };
        
        const nsgResponse = await this.ociClient.virtualNetworkClient.listNetworkSecurityGroups(nsgRequest);
        return {
          success: true,
          data: nsgResponse.items,
          count: nsgResponse.items.length,
          message: `Found ${nsgResponse.items.length} network security groups`
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

      case 'users':
        const usersRequest = {
          compartmentId,
          limit: input.limit || 50
        };
        
        const usersResponse = await this.ociClient.identityClient.listUsers(usersRequest);
        return {
          success: true,
          data: usersResponse.items,
          count: usersResponse.items.length,
          message: `Found ${usersResponse.items.length} users`
        };

      case 'groups':
        const groupsRequest = {
          compartmentId,
          limit: input.limit || 50
        };
        
        const groupsResponse = await this.ociClient.identityClient.listGroups(groupsRequest);
        return {
          success: true,
          data: groupsResponse.items,
          count: groupsResponse.items.length,
          message: `Found ${groupsResponse.items.length} groups`
        };

      case 'policies':
        const policiesRequest = {
          compartmentId,
          limit: input.limit || 50
        };
        
        const policiesResponse = await this.ociClient.identityClient.listPolicies(policiesRequest);
        return {
          success: true,
          data: policiesResponse.items,
          count: policiesResponse.items.length,
          message: `Found ${policiesResponse.items.length} policies`
        };

      default:
        throw new Error(`Unsupported resource type: ${input.resourceType}`);
    }
  }

  private async getResource(input: MonitoringSecurityGetInputSchema['_type']): Promise<OCIResourceDetailResponse> {
    switch (input.resourceType) {
      case 'alarm':
        const alarmResponse = await this.ociClient.monitoringClient.getAlarm({
          alarmId: input.resourceId
        });
        
        return {
          success: true,
          data: alarmResponse.alarm,
          message: `Retrieved alarm details for ${input.resourceId}`
        };

      case 'log-group':
        const logGroupResponse = await this.ociClient.loggingClient.getLogGroup({
          logGroupId: input.resourceId
        });
        
        return {
          success: true,
          data: logGroupResponse.logGroup,
          message: `Retrieved log group details for ${input.resourceId}`
        };

      case 'network-security-group':
        const nsgResponse = await this.ociClient.virtualNetworkClient.getNetworkSecurityGroup({
          networkSecurityGroupId: input.resourceId
        });
        
        return {
          success: true,
          data: nsgResponse.networkSecurityGroup,
          message: `Retrieved network security group details for ${input.resourceId}`
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

      case 'user':
        const userResponse = await this.ociClient.identityClient.getUser({
          userId: input.resourceId
        });
        
        return {
          success: true,
          data: userResponse.user,
          message: `Retrieved user details for ${input.resourceId}`
        };

      case 'group':
        const groupResponse = await this.ociClient.identityClient.getGroup({
          groupId: input.resourceId
        });
        
        return {
          success: true,
          data: groupResponse.group,
          message: `Retrieved group details for ${input.resourceId}`
        };

      case 'policy':
        const policyResponse = await this.ociClient.identityClient.getPolicy({
          policyId: input.resourceId
        });
        
        return {
          success: true,
          data: policyResponse.policy,
          message: `Retrieved policy details for ${input.resourceId}`
        };

      default:
        throw new Error(`Unsupported resource type: ${input.resourceType}`);
    }
  }

  private async createResource(input: MonitoringSecurityCreateInputSchema['_type']): Promise<OCIOperationResponse> {
    switch (input.resourceType) {
      case 'alarm':
        const alarmData = input.data as any;
        const createAlarmRequest = {
          createAlarmDetails: {
            compartmentId: alarmData.compartmentId,
            displayName: alarmData.displayName,
            metricCompartmentId: alarmData.metricCompartmentId,
            namespace: alarmData.namespace,
            query: alarmData.query,
            severity: alarmData.severity,
            destinations: alarmData.destinations,
            isEnabled: alarmData.isEnabled !== false,
            body: alarmData.body,
            pendingDuration: alarmData.pendingDuration || 'PT5M'
          }
        };

        const alarmResult = await this.ociClient.monitoringClient.createAlarm(createAlarmRequest);
        
        return {
          success: true,
          data: alarmResult.alarm,
          message: `Alarm created successfully: ${alarmResult.alarm.displayName}`,
          operationId: alarmResult.alarm.id
        };

      case 'log-group':
        const logGroupData = input.data as any;
        const createLogGroupRequest = {
          createLogGroupDetails: {
            compartmentId: logGroupData.compartmentId,
            displayName: logGroupData.displayName,
            description: logGroupData.description
          }
        };

        const logGroupResult = await this.ociClient.loggingClient.createLogGroup(createLogGroupRequest);
        
        return {
          success: true,
          data: logGroupResult.logGroup,
          message: `Log group created successfully: ${logGroupResult.logGroup.displayName}`,
          operationId: logGroupResult.logGroup.id
        };

      case 'network-security-group':
        const nsgData = input.data as any;
        const createNsgRequest = {
          createNetworkSecurityGroupDetails: {
            compartmentId: nsgData.compartmentId,
            vcnId: nsgData.vcnId,
            displayName: nsgData.displayName
          }
        };

        const nsgResult = await this.ociClient.virtualNetworkClient.createNetworkSecurityGroup(createNsgRequest);
        
        // Add security rules if provided
        if (nsgData.securityRules && nsgData.securityRules.length > 0) {
          for (const rule of nsgData.securityRules) {
            await this.ociClient.virtualNetworkClient.addNetworkSecurityGroupSecurityRules({
              networkSecurityGroupId: nsgResult.networkSecurityGroup.id,
              addNetworkSecurityGroupSecurityRulesDetails: {
                securityRules: [rule]
              }
            });
          }
        }
        
        return {
          success: true,
          data: nsgResult.networkSecurityGroup,
          message: `Network security group created successfully: ${nsgResult.networkSecurityGroup.displayName}`,
          operationId: nsgResult.networkSecurityGroup.id
        };

      case 'user':
        const userData = input.data as any;
        const createUserRequest = {
          createUserDetails: {
            compartmentId: userData.compartmentId,
            name: userData.name,
            description: userData.description,
            email: userData.email
          }
        };

        const userResult = await this.ociClient.identityClient.createUser(createUserRequest);
        
        return {
          success: true,
          data: userResult.user,
          message: `User created successfully: ${userResult.user.name}`,
          operationId: userResult.user.id
        };

      case 'group':
        const groupData = input.data as any;
        const createGroupRequest = {
          createGroupDetails: {
            compartmentId: groupData.compartmentId,
            name: groupData.name,
            description: groupData.description
          }
        };

        const groupResult = await this.ociClient.identityClient.createGroup(createGroupRequest);
        
        return {
          success: true,
          data: groupResult.group,
          message: `Group created successfully: ${groupResult.group.name}`,
          operationId: groupResult.group.id
        };

      case 'policy':
        const policyData = input.data as any;
        const createPolicyRequest = {
          createPolicyDetails: {
            compartmentId: policyData.compartmentId,
            name: policyData.name,
            description: policyData.description,
            statements: policyData.statements || []
          }
        };

        const policyResult = await this.ociClient.identityClient.createPolicy(createPolicyRequest);
        
        return {
          success: true,
          data: policyResult.policy,
          message: `Policy created successfully: ${policyResult.policy.name}`,
          operationId: policyResult.policy.id
        };

      default:
        throw new Error(`Unsupported resource type: ${input.resourceType}`);
    }
  }

  private async manageResource(input: MonitoringSecurityManageInputSchema['_type']): Promise<OCIOperationResponse> {
    switch (input.action) {
      case 'enable-alarm':
        const enableAlarmRequest = {
          alarmId: input.resourceId,
          updateAlarmDetails: {
            isEnabled: true
          }
        };

        const enabledAlarm = await this.ociClient.monitoringClient.updateAlarm(enableAlarmRequest);
        
        return {
          success: true,
          data: enabledAlarm.alarm,
          message: `Alarm enabled: ${input.resourceId}`,
          operationId: input.resourceId
        };

      case 'disable-alarm':
        const disableAlarmRequest = {
          alarmId: input.resourceId,
          updateAlarmDetails: {
            isEnabled: false
          }
        };

        const disabledAlarm = await this.ociClient.monitoringClient.updateAlarm(disableAlarmRequest);
        
        return {
          success: true,
          data: disabledAlarm.alarm,
          message: `Alarm disabled: ${input.resourceId}`,
          operationId: input.resourceId
        };

      case 'update-alarm':
        const updateAlarmRequest = {
          alarmId: input.resourceId,
          updateAlarmDetails: {
            query: input.query,
            severity: input.severity,
            isEnabled: input.isEnabled
          }
        };

        const updatedAlarm = await this.ociClient.monitoringClient.updateAlarm(updateAlarmRequest);
        
        return {
          success: true,
          data: updatedAlarm.alarm,
          message: `Alarm updated: ${input.resourceId}`,
          operationId: input.resourceId
        };

      case 'delete-alarm':
        const deleteAlarmRequest = {
          alarmId: input.resourceId
        };

        await this.ociClient.monitoringClient.deleteAlarm(deleteAlarmRequest);
        
        return {
          success: true,
          message: `Alarm deletion initiated: ${input.resourceId}`,
          operationId: input.resourceId
        };

      case 'add-security-rule':
        if (!input.securityRule) {
          throw new Error('Security rule is required for adding security rule');
        }

        const addRuleRequest = {
          networkSecurityGroupId: input.resourceId,
          addNetworkSecurityGroupSecurityRulesDetails: {
            securityRules: [input.securityRule]
          }
        };

        await this.ociClient.virtualNetworkClient.addNetworkSecurityGroupSecurityRules(addRuleRequest);
        
        return {
          success: true,
          message: `Security rule added to NSG: ${input.resourceId}`,
          operationId: input.resourceId
        };

      case 'add-user-to-group':
        if (!input.userId || !input.groupId) {
          throw new Error('Both userId and groupId are required for adding user to group');
        }

        const addUserRequest = {
          addUserToGroupDetails: {
            userId: input.userId,
            groupId: input.groupId
          }
        };

        const membershipResult = await this.ociClient.identityClient.addUserToGroup(addUserRequest);
        
        return {
          success: true,
          data: membershipResult.userGroupMembership,
          message: `User ${input.userId} added to group ${input.groupId}`,
          operationId: membershipResult.userGroupMembership.id
        };

      case 'remove-user-from-group':
        const removeUserRequest = {
          userGroupMembershipId: input.resourceId
        };

        await this.ociClient.identityClient.removeUserFromGroup(removeUserRequest);
        
        return {
          success: true,
          message: `User removed from group: ${input.resourceId}`,
          operationId: input.resourceId
        };

      default:
        throw new Error(`Unsupported management action: ${input.action}`);
    }
  }
}
