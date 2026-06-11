import { GoogleSignin, isErrorWithCode, statusCodes } from '@react-native-google-signin/google-signin';
import * as React from 'react';
import { useState } from 'react';
import { Alert, Dimensions, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { Noit } from '@/components/Noit';
import { PurpleBg } from '@/components/PurpleBg';
import { supabase } from '@/lib/supabase';

GoogleSignin.configure({
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  scopes: ['email', 'profile'],
});

const { width, height } = Dimensions.get('window');

const STARS = Array.from({ length: 24 }, (_, i) => ({
  id: i,
  cx: 20 + Math.random() * (width - 40),
  cy: 60 + Math.random() * (height - 200),
  r: 0.5 + Math.random() * 1.4,
  opacity: 0.3 + Math.random() * 0.5,
}));

export default function AuthScreen() {
  const [signingIn, setSigningIn] = useState(false);

  const handleLogin = async () => {
    if (signingIn)
      return;
    setSigningIn(true);
    try {
      await GoogleSignin.hasPlayServices();
      const userInfo = await GoogleSignin.signIn();
      const idToken = userInfo.data?.idToken;
      if (!idToken)
        throw new Error('No ID token returned from Google');

      const { error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: idToken,
      });

      if (error) {
        Alert.alert('Sign-in error', error.message);
      }
    }
    catch (e: any) {
      if (isErrorWithCode(e)) {
        if (e.code === statusCodes.SIGN_IN_CANCELLED)
          return;
        if (e.code === statusCodes.IN_PROGRESS)
          return;
        if (e.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
          Alert.alert('Error', 'Google Play Services not available.');
          return;
        }
      }
      Alert.alert('Error', e?.message ?? 'Sign-in failed');
    }
    finally {
      setSigningIn(false);
    }
  };

  return (
    <View style={styles.screen}>
      <PurpleBg />

      <Svg style={StyleSheet.absoluteFillObject} width={width} height={height} pointerEvents="none">
        {STARS.map(s => (
          <Circle key={s.id} cx={s.cx} cy={s.cy} r={s.r} fill="white" opacity={s.opacity} />
        ))}
      </Svg>

      <View style={styles.content}>
        <View style={styles.noitWrap}>
          <Noit state="happy" size={180} />
        </View>

        <Text style={styles.eyebrow}>Welcome</Text>
        <Text style={styles.headline}>
          Meet
          {' '}
          <Text style={styles.headlineEm}>Noit</Text>
          .
        </Text>
        <Text style={styles.sub}>
          Your daily companion for emotional cravings.
          {'\n'}
          A 10-minute ritual to check in with
          yourself.
        </Text>

        <View style={styles.actions}>
          <Pressable
            onPress={handleLogin}
            disabled={signingIn}
            style={[styles.btnGoogle, signingIn && { opacity: 0.6 }]}
          >
            <Svg width={20} height={20} viewBox="0 0 24 24">
              <Path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <Path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <Path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <Path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </Svg>
            <Text style={styles.btnGoogleText}>
              {signingIn ? 'Signing in…' : 'Continue with Google'}
            </Text>
          </Pressable>

          <Text style={styles.legal}>
            By continuing you agree to our Terms & Privacy.
            {'\n'}
            Noit is for adults 18+.
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#5C3E9C',
    overflow: 'hidden',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    width: '100%',
    maxWidth: 440,
    alignItems: 'center',
    paddingHorizontal: 26,
    paddingTop: 80,
    paddingBottom: 36,
  },
  noitWrap: {
    marginTop: 12,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.52)',
    marginTop: 18,
  },
  headline: {
    fontSize: 32,
    fontWeight: '700',
    color: 'white',
    lineHeight: 38,
    textAlign: 'center',
    marginTop: 8,
  },
  headlineEm: {
    color: 'rgba(255,255,255,0.72)',
  },
  sub: {
    fontSize: 14.5,
    color: 'rgba(255,255,255,0.6)',
    lineHeight: 22,
    textAlign: 'center',
    marginTop: 12,
    maxWidth: 320,
  },
  actions: {
    marginTop: 'auto',
    width: '100%',
    alignItems: 'center',
    gap: 14,
  },
  btnGoogle: {
    width: '100%',
    paddingVertical: 17,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 32,
    elevation: 8,
  },
  btnGoogleText: {
    color: '#4A2A80',
    fontSize: 16,
    fontWeight: '700',
  },
  legal: {
    fontSize: 11.5,
    color: 'rgba(255,255,255,0.42)',
    textAlign: 'center',
    lineHeight: 17,
  },
});
