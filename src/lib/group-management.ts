import type { GraphGroup } from "@/lib/types";

function isUnifiedGroup(group: Pick<GraphGroup, "groupTypes">) {
  return group.groupTypes.includes("Unified");
}

function isDynamicGroup(
  group: Pick<GraphGroup, "groupTypes" | "membershipRule">
) {
  return group.groupTypes.includes("DynamicMembership") || !!group.membershipRule;
}

function isSecurityGroup(
  group: Pick<GraphGroup, "mailEnabled" | "securityEnabled" | "groupTypes">
) {
  return !group.mailEnabled && group.securityEnabled && !isUnifiedGroup(group);
}

export function getGroupMembershipManagementBlockReason(
  group: Pick<
    GraphGroup,
    "groupTypes" | "mailEnabled" | "securityEnabled" | "membershipRule" | "isAssignableToRole"
  >
): string | null {
  if (group.isAssignableToRole) {
    return "Role-assignable groups require extra Microsoft Graph permissions.";
  }

  if (isDynamicGroup(group)) {
    return "Dynamic groups don't support direct membership changes.";
  }

  if (isUnifiedGroup(group) || isSecurityGroup(group)) {
    return null;
  }

  if (group.mailEnabled && group.securityEnabled) {
    return "Mail-enabled security groups are read-only in Microsoft Graph.";
  }

  if (group.mailEnabled && !group.securityEnabled) {
    return "Distribution groups are read-only in Microsoft Graph.";
  }

  return "This group type can't be managed through Microsoft Graph membership APIs.";
}

export function withGroupManagementMetadata<T extends GraphGroup>(group: T): T {
  const managementBlockedReason = getGroupMembershipManagementBlockReason(group);

  return {
    ...group,
    canManageMembership: managementBlockedReason === null,
    managementBlockedReason,
  };
}
