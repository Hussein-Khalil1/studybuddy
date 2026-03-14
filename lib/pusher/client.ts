import Pusher from "pusher-js";
import { getPusherClientConfig } from "./env";

let pusherClientSingleton: Pusher | null | undefined;

export function getPusherClient() {
  if (pusherClientSingleton !== undefined) {
    return pusherClientSingleton;
  }

  const config = getPusherClientConfig();
  if (!config) {
    pusherClientSingleton = null;
    return pusherClientSingleton;
  }

  pusherClientSingleton = new Pusher(config.key, {
    cluster: config.cluster,
    forceTLS: true,
  });

  return pusherClientSingleton;
}
