import '../global.css';

import * as SplashScreen from 'expo-splash-screen';
import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef, useState } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { CrashScreen } from '@/components/crash-screen';
import { useNotificationStore } from '@/features/notifications/notification-store';
import { useAuthStore } from '@/lib/auth-store';
import { maybeCreateDailyNotification } from '@/lib/daily-notification-runner';
import { registerForPushNotifications, savePushToken } from '@/lib/push-notifications';
import { initCache } from '@/lib/storage';
import { supabase } from '@/lib/supabase';

SplashScreen.preventAutoHideAsync();

/**
 * On every successful auth, run background bootstrap:
 * - Save push token if notifications enabled
 * - Subscribe to realtime notifications channel
 * - Insert today's daily notification (if not already done)
 */
let realtimeUnsub: (() => void) | null = null;

async function bootstrapUserSession(
  userId: string,
  userName: string | null | undefined,
  notificationsEnabled: boolean | null | undefined,
) {
  // Every step is isolated: a failure in one (e.g. push/FCM not configured on a
  // standalone build) must NEVER crash the app nor block the others. This runs
  // in the background right after login.

  // 1) Realtime subscription — live updates to bell badge
  try {
    if (realtimeUnsub) realtimeUnsub();
    realtimeUnsub = useNotificationStore.getState().subscribeRealtime(userId);
  }
  catch (e) {
    console.warn('[bootstrap] realtime subscribe failed:', e);
  }

  // 2) Preload notifications into store
  try {
    useNotificationStore.getState().fetchNotifications(userId).catch(() => {});
  }
  catch (e) {
    console.warn('[bootstrap] fetchNotifications failed:', e);
  }

  // 3) Save Expo push token if notifications opted in
  if (notificationsEnabled !== false) {
    try {
      const token = await registerForPushNotifications();
      if (token) {
        await savePushToken(userId, token).catch(() => {});
      }
    }
    catch (e) {
      console.warn('[bootstrap] push token failed:', e);
    }
  }

  // 4) Maybe create today's daily notification (idempotent)
  try {
    await maybeCreateDailyNotification(userId, userName);
  }
  catch (e) {
    console.warn('[bootstrap] daily notification failed:', e);
  }
}

export default function RootLayout() {
  const setSession = useAuthStore((s) => s.setSession);
  const setUser = useAuthStore((s) => s.setUser);
  const setLoading = useAuthStore((s) => s.setLoading);
  const isLoading = useAuthStore((s) => s.isLoading);
  const didInit = useRef(false);
  const [cacheReady, setCacheReady] = useState(false);
  // TEMP: capture async/non-render errors (ErrorBoundary only catches render).
  const [globalError, setGlobalError] = useState<Error | null>(null);

  useEffect(() => {
    void initCache().then(() => setCacheReady(true));
  }, []);

  // TEMP diagnostic: surface uncaught JS errors on-screen instead of a silent
  // native crash. Remove once the post-auth crash is identified.
  useEffect(() => {
    const g = globalThis as any;
    const prevHandler = g.ErrorUtils?.getGlobalHandler?.();
    g.ErrorUtils?.setGlobalHandler?.((err: Error, _isFatal?: boolean) => {
      setGlobalError(err);
      // still log so it shows in any attached console
      console.error('[GLOBAL ERROR]', err);
    });
    return () => {
      if (prevHandler) g.ErrorUtils?.setGlobalHandler?.(prevHandler);
    };
  }, []);

  useEffect(() => {
    if (!cacheReady) return;
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'INITIAL_SESSION' && didInit.current) return;
      if (event === 'INITIAL_SESSION') didInit.current = true;

      setSession(session);

      if (!session) {
        // Clean up realtime subscription on sign-out
        if (realtimeUnsub) { realtimeUnsub(); realtimeUnsub = null; }
        setUser(null);
        setLoading(false);
        router.replace('/');
        return;
      }

      // Usa maybeSingle: non crasha se 0 righe
      const { data: profile } = await supabase
        .from('users')
        .select('*')
        .eq('id', session.user.id)
        .maybeSingle();

      if (profile) {
        setUser(profile);
        setLoading(false);

        // Background: bootstrap notifications + push token + daily notification
        bootstrapUserSession(profile.id, profile.name, profile.notifications_enabled).catch(
          (e) => console.warn('[bootstrap] failed:', e),
        );

        router.replace(profile.role_completed ? '/(tabs)/home' : '/onboarding');
        return;
      }

      // Riga non esiste: creala
      const meta = session.user.user_metadata ?? {};
      const { data: created, error } = await supabase
        .from('users')
        .insert({
          id: session.user.id,
          email: session.user.email ?? '',
          name: meta.full_name ?? meta.name ?? session.user.email?.split('@')[0] ?? '',
          avatar_url: meta.avatar_url ?? null,
        })
        .select()
        .maybeSingle();

      // Se 409 conflict, rileggi (la riga esiste ma RLS non la vedeva)
      if (error?.code === '23505') {
        const { data: retry } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .maybeSingle();
        setUser(retry ?? null);
        setLoading(false);
        router.replace(retry?.role_completed ? '/(tabs)/home' : '/onboarding');
        return;
      }

      setUser(created ?? null);
      setLoading(false);
      router.replace('/onboarding');
    });

    return () => subscription.unsubscribe();
  }, [cacheReady]);

  useEffect(() => {
    if (!isLoading) {
      SplashScreen.hideAsync();
    }
  }, [isLoading]);

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <StatusBar style="light" />
        {/* TEMP CrashScreen fallback — shows errors on-screen instead of a
            silent crash, to diagnose the post-auth crash without USB. */}
        {globalError
          ? (
              <CrashScreen error={globalError} resetErrorBoundary={() => setGlobalError(null)} />
            )
          : (
              <ErrorBoundary FallbackComponent={CrashScreen}>
                <Stack screenOptions={{ headerShown: false }}>
                  <Stack.Screen name="index" />
                  <Stack.Screen name="onboarding" />
                  <Stack.Screen name="session" />
                  <Stack.Screen name="(tabs)" />
                </Stack>
              </ErrorBoundary>
            )}
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}
