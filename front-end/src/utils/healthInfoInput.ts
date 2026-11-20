export const EMERGENCY_CONTACT_NAME_MAX_LENGTH = 150;
export const EMERGENCY_CONTACT_NUMBER_MAX_LENGTH = 11;

export function sanitizeEmergencyContactName(value: string): string {
  return value.replace(/[0-9]/g, '').slice(0, EMERGENCY_CONTACT_NAME_MAX_LENGTH);
}

export function sanitizeEmergencyContactNumber(value: string): string {
  return value.replace(/[^0-9]/g, '').slice(0, EMERGENCY_CONTACT_NUMBER_MAX_LENGTH);
}
