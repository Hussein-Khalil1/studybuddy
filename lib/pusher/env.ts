function clean(value: string | undefined) {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function getPusherServerConfig() {
  const appId = clean(process.env.PUSHER_APP_ID);
  const key = clean(process.env.PUSHER_KEY);
  const secret = clean(process.env.PUSHER_SECRET);
  const cluster = clean(process.env.PUSHER_CLUSTER);

  if (!appId || !key || !secret || !cluster) {
    return null;
  }

  return { appId, key, secret, cluster };
}

export function getPusherClientConfig() {
  const key = clean(process.env.NEXT_PUBLIC_PUSHER_KEY) ?? clean(process.env.PUSHER_KEY);
  const cluster = clean(process.env.NEXT_PUBLIC_PUSHER_CLUSTER) ?? clean(process.env.PUSHER_CLUSTER);

  if (!key || !cluster) {
    return null;
  }

  return { key, cluster };
}
