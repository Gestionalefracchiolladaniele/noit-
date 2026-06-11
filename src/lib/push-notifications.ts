import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { supabase } from './supabase';

/** EAS project id — required by getExpoPushTokenAsync in standalone builds. */
const PROJECT_ID
  = Constants.expoConfig?.extra?.eas?.projectId
    ?? Constants.easConfig?.projectId
    ?? undefined;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registerForPushNotifications(): Promise<string | null> {
  if (Platform.OS === 'web') return null;

  // Fully defensive: a failure here (missing FCM config, no projectId, native
  // notif module error) must NEVER crash the app — it runs in the post-login
  // bootstrap path. On any error we just return null (no push token).
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;

    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') return null;

    // projectId is REQUIRED in standalone builds; passing it explicitly avoids
    // the "No projectId found" throw that otherwise bubbles up as a crash.
    const token = await Notifications.getExpoPushTokenAsync(
      PROJECT_ID ? { projectId: PROJECT_ID } : undefined,
    );
    return token.data;
  }
  catch (e) {
    console.warn('[push] registerForPushNotifications failed (non-fatal):', e);
    return null;
  }
}

export async function savePushToken(userId: string, token: string): Promise<void> {
  await supabase
    .from('users')
    .update({ push_token: token } as any)
    .eq('id', userId);
}

/**
 * Parse "HH:MM" → { hour, minute } (24h). Returns null on invalid input.
 */
function parseTime(timeStr: string): { hour: number; minute: number } | null {
  const m = timeStr.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const hour = parseInt(m[1], 10);
  const minute = parseInt(m[2], 10);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute };
}

/**
 * Cancel all currently scheduled Noit reminders (session/check-in/streak).
 */
export async function cancelAllNoitReminders(): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const n of scheduled) {
    const t = (n.content.data as any)?.type;
    if (t === 'session_reminder' || t === 'daily_check_in') {
      await Notifications.cancelScheduledNotificationAsync(n.identifier);
    }
  }
}

/**
 * Schedule a recurring daily session reminder at a given local time.
 * `timeStr` format: "HH:MM" (e.g. "21:00"). Replaces any existing reminder.
 */
export async function scheduleDailySessionReminder(timeStr: string): Promise<boolean> {
  const parsed = parseTime(timeStr);
  if (!parsed) return false;

  // Wipe previous reminders of the same type
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const n of scheduled) {
    if ((n.content.data as any)?.type === 'session_reminder') {
      await Notifications.cancelScheduledNotificationAsync(n.identifier);
    }
  }

  await Notifications.scheduleNotificationAsync({
    content: {
      title: '🌊 Noit is waiting',
      body: "Ready for today's session? It's just 10 minutes.",
      data: { type: 'session_reminder' },
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: parsed.hour,
      minute: parsed.minute,
    },
  });

  return true;
}

export async function cancelSessionReminder(): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const n of scheduled) {
    if ((n.content.data as any)?.type === 'session_reminder') {
      await Notifications.cancelScheduledNotificationAsync(n.identifier);
    }
  }
}

export async function hasSessionReminderScheduled(): Promise<boolean> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  return scheduled.some((n) => (n.content.data as any)?.type === 'session_reminder');
}

/**
 * Send a one-shot local notification immediately (for streak milestones, etc.)
 */
export async function sendLocalNotification(title: string, body: string, data?: any): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: { title, body, data: data ?? {}, sound: true },
    trigger: null, // immediate
  });
}
