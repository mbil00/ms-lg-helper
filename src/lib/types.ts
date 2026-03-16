// MS Graph API types
export interface GraphUser {
  id: string;
  displayName: string;
  mail: string | null;
  userPrincipalName: string;
  accountEnabled: boolean;
  jobTitle: string | null;
  department: string | null;
  assignedLicenses?: { skuId: string; disabledPlans: string[] }[];
}

export interface GraphLicense {
  skuId: string;
  skuPartNumber: string;
  prepaidUnits: {
    enabled: number;
    suspended: number;
    warning: number;
    lockedOut: number;
  };
  consumedUnits: number;
  servicePlans: {
    servicePlanId: string;
    servicePlanName: string;
    provisioningStatus: string;
    appliesTo: string;
  }[];
}

export interface GraphGroup {
  id: string;
  displayName: string;
  description: string | null;
  groupTypes: string[];
  mailEnabled: boolean;
  securityEnabled: boolean;
  membershipRule: string | null;
  memberCount?: number;
}

export interface LicenseAssignee {
  type: "user" | "group";
  id: string;
  displayName: string;
  userPrincipalName?: string;
  memberCount?: number;
}

// Operation types
export type OperationType =
  | "assign_license"
  | "remove_license"
  | "add_to_group"
  | "remove_from_group";

export interface OperationParams {
  skuIds?: string[];
  groupIds?: string[];
  skuNames?: string[];
  groupNames?: string[];
}

export interface DryRunResult {
  willProcess: { userId: string; displayName: string }[];
  willSkip: { userId: string; displayName: string; reason: string }[];
  errors: { userId: string; displayName: string; error: string }[];
}

export interface OperationProgress {
  operationId: string;
  status: string;
  total: number;
  success: number;
  skipped: number;
  failed: number;
  currentUser?: string;
}
