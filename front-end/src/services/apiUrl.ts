const configuredUrl = process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/+$/, '');

export const API_V1_URL = configuredUrl
  ? /\/api\/v1$/i.test(configuredUrl)
    ? configuredUrl
    : `${configuredUrl}/api/v1`
  : undefined;
