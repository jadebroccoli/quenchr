import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { Link, router } from 'expo-router';
import { supabase } from '@quenchr/supabase-client';
import { colors, type as typ, spacing, radius } from '../../src/tokens';
import { QuenchrLogo } from '../../src/components/ui';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (error) {
      Alert.alert('Login Failed', error.message);
    } else {
      router.replace('/');
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.header}>
        <QuenchrLogo size={80} variant="brown" />
        <Text style={styles.logo}>Quenchr</Text>
        <Text style={styles.tagline}>Clean your algorithm.{'\n'}Scroll without anxiety.</Text>
      </View>

      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={colors.ink4}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor={colors.ink4}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={loading}
        >
          <Text style={styles.buttonText}>{loading ? 'Signing in...' : 'Sign In'}</Text>
        </TouchableOpacity>

        <Link href="/(auth)/signup" asChild>
          <TouchableOpacity style={styles.linkButton}>
            <Text style={styles.linkText}>
              Don't have an account? <Text style={styles.linkBold}>Sign Up</Text>
            </Text>
          </TouchableOpacity>
        </Link>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.cream,
    justifyContent: 'center',
    paddingHorizontal: spacing.pagePad,
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logo: {
    ...typ.h1,
    color: colors.brown,
    marginTop: 14,
  },
  tagline: {
    ...typ.body,
    color: colors.ink3,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 22,
  },
  form: {
    gap: 14,
  },
  input: {
    backgroundColor: colors.cream2,
    borderRadius: radius.btn,
    padding: 16,
    fontSize: 15,
    fontFamily: 'DMSans_500Medium',
    color: colors.ink,
    borderWidth: 1,
    borderColor: colors.cream3,
  },
  button: {
    backgroundColor: colors.brown,
    borderRadius: radius.btn,
    padding: 16,
    alignItems: 'center',
    marginTop: 6,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    ...typ.btn,
    color: colors.lt,
  },
  linkButton: {
    alignItems: 'center',
    marginTop: 8,
  },
  linkText: {
    ...typ.body,
    color: colors.ink3,
  },
  linkBold: {
    color: colors.brown,
    fontFamily: 'DMSans_700Bold',
  },
});
