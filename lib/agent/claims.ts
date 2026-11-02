// Display only. This never reaches the policy engine: a claimed approval is a reason for a person to look
// harder, not a reason to allow.
const APPROVAL_CLAIM =
  /\b(approv\w*|authori[sz]\w*|signed off|sign-off|ceo|cfo|cto|boss|manager|director|override|ignore (your|the|all|any) (limits?|rules?|instructions?))\b/i;

export function claimsApproval(goal: string | undefined | null): boolean {
  return !!goal && APPROVAL_CLAIM.test(goal);
}
