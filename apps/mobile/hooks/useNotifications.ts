import { useEffect, useRef } from "react";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import {
  requestPermissions,
  setupNotificationCategories,
  getPushToken,
} from "@/lib/notifications";

export function useNotifications() {
  const router = useRouter();
  const registerPushToken = useMutation(api.users.registerPushToken);
  const responseListener = useRef<Notifications.Subscription | null>(null);
  const notificationListener = useRef<Notifications.Subscription | null>(null);

  useEffect(() => {
    (async () => {
      const granted = await requestPermissions();
      await setupNotificationCategories();
      if (granted) {
        const token = await getPushToken();
        if (token) {
          await registerPushToken({ token }).catch(() => {});
        }
      }
    })();

    responseListener.current =
      Notifications.addNotificationResponseReceivedListener((response) => {
        const data = response.notification.request.content.data;
        const actionId = response.actionIdentifier;

        if (actionId === "reply") {
          const userText = (response as any).userText;
          // TODO: Send reply via Convex mutation when backend supports it
          console.log("Reply from notification:", userText, data);
        }

        if (data?.channelId) {
          router.push({
            pathname: "/channel/[channelId]",
            params: { channelId: data.channelId as string },
          });
        } else if (data?.conversationId) {
          router.push({
            pathname: "/dm/[conversationId]",
            params: { conversationId: data.conversationId as string },
          });
        }
      });

    notificationListener.current =
      Notifications.addNotificationReceivedListener(() => {
        // No-op: Convex live queries already update the UI
      });

    return () => {
      responseListener.current?.remove();
      notificationListener.current?.remove();
    };
  }, [router]);
}
