import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
  StatusBar, Linking,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../utils/supabase';
import { colors, spacing, radius } from '../utils/theme';

// Replace with real Stripe links when ready
const STRIPE_ANNUAL  = 'https://buy.stripe.com/test_bJeaEQaAa1M7bJg96Odwc01';
const STRIPE_MONTHLY = 'https://buy.stripe.com/test_5kQ7sE8s28av5kSdn4dwc00';

const FREE_FEATURES = [
  { label: 'Up to 4 players per round', pro: false },
  { label: 'All standard bean types', pro: false },
  { label: 'Live scorecard & leaderboard', pro: false },
  { label: 'Round history', pro: false },
];

const PRO_EXTRAS = [
  { label: '5th player slot', pro: true },
  { label: 'Pro-only bean types (Nassau, Skins…)', pro: true },
  { label: 'Unlimited round history', pro: true },
  { label: 'Priority support', pro: true },
];

function Check({ pro }) {
  return (
    <View style={[styles.check, pro && styles.checkPro]}>
      <Text style={styles.checkMark}>✓</Text>
    </View>
  );
}

// ─── Forgot password screen ───────────────────────────────────────────────────
function ForgotScreen({ onBack }) {
  const { forgotPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [busy, setBusy]   = useState(false);
  const [sent, setSent]   = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    setError('');
    if (!email.trim()) { setError('Enter your email address.'); return; }
    setBusy(true);
    try {
      await forgotPassword(email.trim());
      setSent(true);
    } catch (e) {
      setError(e.message || 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />
      <View style={styles.hero}>
        <Text style={styles.heroEmoji}>🔑</Text>
        <Text style={styles.heroTitle}>Reset Password</Text>
        <Text style={styles.heroSub}>We'll email you a reset link</Text>
      </View>
      <KeyboardAvoidingView style={styles.cardWrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.card} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {sent ? (
            <>
              <View style={styles.successWrap}>
                <Text style={styles.successText}>✅ Check your inbox — we sent a reset link to {email}.</Text>
              </View>
              <TouchableOpacity style={styles.submitBtn} onPress={onBack} activeOpacity={0.85}>
                <Text style={styles.submitText}>Back to Sign In</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.formTitle}>Forgot your password?</Text>
              <View style={styles.inputWrap}>
                <Text style={styles.inputIcon}>✉️</Text>
                <TextInput style={styles.input} placeholder="Email address" placeholderTextColor={colors.textLight}
                  value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address"
                  returnKeyType="done" onSubmitEditing={submit} />
              </View>
              {!!error && (
                <View style={styles.errorWrap}>
                  <Text style={styles.errorText}>⚠️ {error}</Text>
                </View>
              )}
              <TouchableOpacity style={[styles.submitBtn, busy && styles.submitBtnDisabled]} onPress={submit} disabled={busy} activeOpacity={0.85}>
                {busy ? <ActivityIndicator color={colors.white} /> : <Text style={styles.submitText}>Send Reset Link</Text>}
              </TouchableOpacity>
              <TouchableOpacity onPress={onBack} style={styles.backLink}>
                <Text style={styles.backLinkText}>← Back to Sign In</Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

// ─── Reset password screen (after email link) ─────────────────────────────────
function ResetScreen({ onDone }) {
  const { updatePassword } = useAuth();
  const [password, setPassword]   = useState('');
  const [confirm, setConfirm]     = useState('');
  const [showPw, setShowPw]       = useState(false);
  const [busy, setBusy]           = useState(false);
  const [error, setError]         = useState('');
  const [done, setDone]           = useState(false);

  async function submit() {
    setError('');
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (password !== confirm)  { setError('Passwords do not match.'); return; }
    setBusy(true);
    try {
      await updatePassword(password);
      setDone(true);
    } catch (e) {
      setError(e.message || 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />
      <View style={styles.hero}>
        <Text style={styles.heroEmoji}>🔐</Text>
        <Text style={styles.heroTitle}>New Password</Text>
        <Text style={styles.heroSub}>Choose a strong password</Text>
      </View>
      <KeyboardAvoidingView style={styles.cardWrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.card} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {done ? (
            <>
              <View style={styles.successWrap}>
                <Text style={styles.successText}>✅ Password updated! You're now signed in.</Text>
              </View>
              <TouchableOpacity style={styles.submitBtn} onPress={onDone} activeOpacity={0.85}>
                <Text style={styles.submitText}>Continue →</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.formTitle}>Set a new password</Text>
              <View style={styles.inputWrap}>
                <Text style={styles.inputIcon}>🔒</Text>
                <TextInput style={[styles.input, { flex: 1 }]} placeholder="New password" placeholderTextColor={colors.textLight}
                  value={password} onChangeText={setPassword} secureTextEntry={!showPw} returnKeyType="next" />
                <TouchableOpacity onPress={() => setShowPw(p => !p)} style={styles.eyeBtn}>
                  <Text style={styles.eyeIcon}>{showPw ? '🙈' : '👁️'}</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.inputWrap}>
                <Text style={styles.inputIcon}>🔒</Text>
                <TextInput style={styles.input} placeholder="Confirm new password" placeholderTextColor={colors.textLight}
                  value={confirm} onChangeText={setConfirm} secureTextEntry={!showPw}
                  returnKeyType="done" onSubmitEditing={submit} />
              </View>
              {!!error && (
                <View style={styles.errorWrap}>
                  <Text style={styles.errorText}>⚠️ {error}</Text>
                </View>
              )}
              <TouchableOpacity style={[styles.submitBtn, busy && styles.submitBtnDisabled]} onPress={submit} disabled={busy} activeOpacity={0.85}>
                {busy ? <ActivityIndicator color={colors.white} /> : <Text style={styles.submitText}>Update Password</Text>}
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

// ─── Step 1: Auth form ────────────────────────────────────────────────────────
function AuthForm({ onSkip, initialMode, onSignedUp, onForgot }) {
  const { signUp, signIn, signInWithGoogle } = useAuth();
  const [mode, setMode] = useState(initialMode === 'signup' ? 'signup' : 'signin');
  const [fullName, setFullName]         = useState('');
  const [scoringName, setScoringName]   = useState('');
  const [email, setEmail]               = useState('');
  const [password, setPassword]         = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setBusy_error]          = useState('');
  const [busy, setBusy]                 = useState(false);

  const isSignUp = mode === 'signup';

  async function submit() {
    setBusy_error('');
    if (!email.trim() || !password) { setBusy_error('Enter an email and password.'); return; }
    if (isSignUp && !fullName.trim()) { setBusy_error('Enter your name.'); return; }
    if (isSignUp && !scoringName.trim()) { setBusy_error('Enter a scoring name.'); return; }
    if (password.length < 6)          { setBusy_error('Password must be at least 6 characters.'); return; }
    setBusy(true);
    try {
      if (isSignUp) {
        await signUp(email.trim(), password, fullName.trim(), scoringName.trim());
        onSignedUp();
      } else {
        await signIn(email.trim(), password);
        onSkip();
      }
    } catch (e) {
      setBusy_error(e.message || 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />
      <View style={styles.hero}>
        <Text style={styles.heroEmoji}>⛳</Text>
        <Text style={styles.heroTitle}>TeeWager</Text>
        <Text style={styles.heroSub}>Friendly wagers. Every round.</Text>
      </View>

      <KeyboardAvoidingView style={styles.cardWrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.card} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.tabs}>
            <TouchableOpacity style={[styles.tab, !isSignUp && styles.tabActive]} onPress={() => { setMode('signin'); setBusy_error(''); }}>
              <Text style={[styles.tabText, !isSignUp && styles.tabTextActive]}>Sign In</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.tab, isSignUp && styles.tabActive]} onPress={() => { setMode('signup'); setBusy_error(''); }}>
              <Text style={[styles.tabText, isSignUp && styles.tabTextActive]}>Create Account</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.formTitle}>{isSignUp ? 'Join TeeWager' : 'Welcome back'}</Text>

          {isSignUp && (
            <>
              <View style={styles.inputWrap}>
                <Text style={styles.inputIcon}>👤</Text>
                <TextInput style={styles.input} placeholder="Full name (e.g. John Smith)" placeholderTextColor={colors.textLight}
                  value={fullName} onChangeText={setFullName} autoCapitalize="words" returnKeyType="next" />
              </View>
              <Text style={styles.inputHint}>What should we call you on the scorecard?</Text>
              <View style={styles.inputWrap}>
                <Text style={styles.inputIcon}>🏌️</Text>
                <TextInput style={styles.input} placeholder='Scoring name (e.g. "Ace")' placeholderTextColor={colors.textLight}
                  value={scoringName} onChangeText={setScoringName} autoCapitalize="words" returnKeyType="next" />
              </View>
            </>
          )}

          <View style={styles.inputWrap}>
            <Text style={styles.inputIcon}>✉️</Text>
            <TextInput style={styles.input} placeholder="Email address" placeholderTextColor={colors.textLight}
              value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" returnKeyType="next" />
          </View>

          <View style={styles.inputWrap}>
            <Text style={styles.inputIcon}>🔒</Text>
            <TextInput style={[styles.input, { flex: 1 }]} placeholder="Password" placeholderTextColor={colors.textLight}
              value={password} onChangeText={setPassword} secureTextEntry={!showPassword}
              returnKeyType="done" onSubmitEditing={submit} />
            <TouchableOpacity onPress={() => setShowPassword(p => !p)} style={styles.eyeBtn}>
              <Text style={styles.eyeIcon}>{showPassword ? '🙈' : '👁️'}</Text>
            </TouchableOpacity>
          </View>

          {!isSignUp && (
            <TouchableOpacity onPress={onForgot} style={styles.forgotLink}>
              <Text style={styles.forgotLinkText}>Forgot password?</Text>
            </TouchableOpacity>
          )}

          {!!error && (
            <View style={styles.errorWrap}>
              <Text style={styles.errorText}>⚠️ {error}</Text>
            </View>
          )}

          <TouchableOpacity style={[styles.submitBtn, busy && styles.submitBtnDisabled]} onPress={submit} disabled={busy} activeOpacity={0.85}>
            {busy ? <ActivityIndicator color={colors.white} /> : <Text style={styles.submitText}>{isSignUp ? 'Create Account' : 'Sign In'}</Text>}
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity style={styles.googleBtn} onPress={signInWithGoogle} activeOpacity={0.85}>
            <Text style={styles.googleBtnIcon}>G</Text>
            <Text style={styles.googleBtnText}>Continue with Google</Text>
          </TouchableOpacity>

          {isSignUp && (
            <Text style={styles.terms}>By creating an account you agree to our Terms of Service and Privacy Policy.</Text>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

// ─── Step 2: Plan picker ──────────────────────────────────────────────────────
function PlanPicker({ onSelectFree, onSelectPro, onSelectAnnual, onSelectLifetime }) {
  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />
      <View style={[styles.hero, { paddingBottom: 24 }]}>
        <Text style={styles.heroEmoji}>🎉</Text>
        <Text style={styles.heroTitle}>Account created!</Text>
        <Text style={styles.heroSub}>Choose how you want to play</Text>
      </View>

      <ScrollView contentContainerStyle={[styles.card, { borderTopLeftRadius: 28, borderTopRightRadius: 28, flexGrow: 1 }]} showsVerticalScrollIndicator={false}>
        <Text style={styles.planHeading}>Pick your plan</Text>
        <Text style={styles.planSub}>You can upgrade or change anytime.</Text>

        {/* Monthly — featured */}
        <TouchableOpacity style={[styles.planCard, styles.planCardPro]} onPress={onSelectPro} activeOpacity={0.85}>
          <View style={styles.proBadge}><Text style={styles.proBadgeText}>MOST POPULAR</Text></View>
          <View style={styles.planCardHeader}>
            <Text style={[styles.planName, { color: colors.white }]}>Pro Monthly</Text>
            <Text style={[styles.planPrice, { color: colors.white }]}>$2.99<Text style={[styles.planPer, { color: 'rgba(255,255,255,0.75)' }]}>/mo</Text></Text>
          </View>
          <Text style={styles.planDesc}>Try Pro with no commitment. All premium features unlocked — cancel anytime. Best way to get started.</Text>
          <View style={[styles.planCta, styles.planCtaPro]}>
            <Text style={[styles.planCtaText, { color: colors.green }]}>Start Pro for $2.99 →</Text>
          </View>
        </TouchableOpacity>

        {/* Annual */}
        <TouchableOpacity style={styles.planCard} onPress={onSelectAnnual} activeOpacity={0.85}>
          <View style={styles.planCardHeader}>
            <Text style={styles.planName}>Pro Annual</Text>
            <Text style={styles.planPrice}>$29.90<Text style={styles.planPer}>/yr</Text></Text>
          </View>
          <Text style={[styles.planDesc, { color: colors.textMid }]}>Save 17% vs monthly — just $2.49/month. Great if you play year-round and want the best deal on Pro.</Text>
          <View style={[styles.planCta, styles.planCtaFree]}>
            <Text style={[styles.planCtaText, { color: colors.green }]}>Save with Annual →</Text>
          </View>
        </TouchableOpacity>

        {/* Lifetime */}
        <TouchableOpacity style={styles.planCard} onPress={onSelectLifetime} activeOpacity={0.85}>
          <View style={styles.planCardHeader}>
            <Text style={styles.planName}>Pro Lifetime</Text>
            <Text style={styles.planPrice}>$49.99<Text style={styles.planPer}> once</Text></Text>
          </View>
          <Text style={[styles.planDesc, { color: colors.textMid }]}>Pay once, play forever. Covers itself in under 2 years — no recurring charges, ever.</Text>
          <View style={[styles.planCta, styles.planCtaFree]}>
            <Text style={[styles.planCtaText, { color: colors.green }]}>Own it forever →</Text>
          </View>
        </TouchableOpacity>

        {/* Free */}
        <TouchableOpacity style={[styles.planCard, { borderStyle: 'dashed' }]} onPress={onSelectFree} activeOpacity={0.85}>
          <View style={styles.planCardHeader}>
            <Text style={styles.planName}>Free</Text>
            <Text style={styles.planPrice}>$0</Text>
          </View>
          <Text style={[styles.planDesc, { color: colors.textMid }]}>Up to 4 players, core bean types, and round history. A great way to try TeeWager before upgrading.</Text>
          <View style={[styles.planCta, { backgroundColor: colors.background, borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.pill, paddingVertical: 13, alignItems: 'center', marginTop: spacing.md }]}>
            <Text style={[styles.planCtaText, { color: colors.textMid }]}>Continue free →</Text>
          </View>
        </TouchableOpacity>

        <Text style={styles.planFootnote}>Pro subscriptions billed through Stripe. Cancel anytime.</Text>
      </ScrollView>
    </View>
  );
}

// ─── Step 3: Welcome screen ───────────────────────────────────────────────────
function WelcomeScreen({ plan, onDone }) {
  const isPro = plan === 'pro';
  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" />
      <View style={[styles.hero, { paddingBottom: 20 }]}>
        <Text style={styles.heroEmoji}>{isPro ? '🏆' : '⛳'}</Text>
        <Text style={styles.heroTitle}>{isPro ? 'Welcome, Pro!' : 'Welcome!'}</Text>
        <Text style={styles.heroSub}>{isPro ? 'All features unlocked.' : "You're on the free plan."}</Text>
      </View>

      <ScrollView contentContainerStyle={[styles.card, { borderTopLeftRadius: 28, borderTopRightRadius: 28, flexGrow: 1 }]} showsVerticalScrollIndicator={false}>
        <Text style={styles.planHeading}>What you have access to</Text>

        {FREE_FEATURES.map(f => (
          <View key={f.label} style={styles.featureRow}>
            <Check pro={false} />
            <Text style={styles.featureText}>{f.label}</Text>
          </View>
        ))}

        {isPro && PRO_EXTRAS.map(f => (
          <View key={f.label} style={styles.featureRow}>
            <Check pro={true} />
            <Text style={styles.featureText}>{f.label}</Text>
          </View>
        ))}

        {!isPro && (
          <View style={styles.upgradeNudge}>
            <Text style={styles.upgradeNudgeTitle}>Want more?</Text>
            <Text style={styles.upgradeNudgeBody}>
              Upgrade to Pro for a 5th player, exclusive bean types, and unlimited history — just $29.90/year.
            </Text>
            <TouchableOpacity
              style={styles.upgradeNudgeBtn}
              onPress={() => Linking.openURL(STRIPE_ANNUAL)}
              activeOpacity={0.85}
            >
              <Text style={styles.upgradeNudgeBtnText}>Upgrade to Pro</Text>
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity style={styles.submitBtn} onPress={onDone} activeOpacity={0.85}>
          <Text style={styles.submitText}>Start Playing →</Text>
        </TouchableOpacity>

        <Text style={styles.terms}>You can upgrade anytime from the account menu.</Text>
      </ScrollView>
    </View>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────
export default function AuthScreen({ onSkip, initialMode }) {
  const [step, setStep] = useState('auth'); // 'auth' | 'forgot' | 'reset' | 'plan' | 'welcome'
  const [plan, setPlan] = useState('free');

  // Detect password-reset redirect (?mode=reset in URL)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('mode') === 'reset') {
        setStep('reset');
        // Clean the URL
        const clean = window.location.pathname;
        window.history.replaceState({}, '', clean);
      }
    }
  }, []);

  function handleSelectMonthly() {
    setPlan('pro');
    Linking.openURL(STRIPE_MONTHLY);
    setStep('welcome');
  }

  function handleSelectAnnual() {
    setPlan('pro');
    Linking.openURL(STRIPE_ANNUAL);
    setStep('welcome');
  }

  function handleSelectLifetime() {
    setPlan('pro');
    Linking.openURL(STRIPE_LIFETIME);
    setStep('welcome');
  }

  function handleSelectFree() {
    setPlan('free');
    setStep('welcome');
  }

  if (step === 'forgot') return <ForgotScreen onBack={() => setStep('auth')} />;
  if (step === 'reset')  return <ResetScreen onDone={onSkip} />;

  if (step === 'plan') {
    return <PlanPicker onSelectFree={handleSelectFree} onSelectPro={handleSelectMonthly} onSelectAnnual={handleSelectAnnual} onSelectLifetime={handleSelectLifetime} />;
  }

  if (step === 'welcome') {
    return <WelcomeScreen plan={plan} onDone={onSkip} />;
  }

  return (
    <AuthForm
      onSkip={onSkip}
      initialMode={initialMode}
      onSignedUp={() => setStep('plan')}
      onForgot={() => setStep('forgot')}
    />
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root:     { flex: 1, backgroundColor: colors.green },

  hero:     { alignItems: 'center', paddingTop: 70, paddingBottom: 32, paddingHorizontal: spacing.xl },
  heroEmoji:{ fontSize: 52, marginBottom: spacing.sm },
  heroTitle:{ fontSize: 36, fontWeight: '900', color: colors.white, letterSpacing: -0.5 },
  heroSub:  { fontSize: 15, color: 'rgba(255,255,255,0.7)', marginTop: spacing.xs },

  cardWrap: { flex: 1 },
  card:     { backgroundColor: colors.white, padding: spacing.lg, paddingBottom: 44 },

  tabs:         { flexDirection: 'row', backgroundColor: colors.background, borderRadius: radius.pill, padding: 4, marginBottom: spacing.lg },
  tab:          { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: radius.pill },
  tabActive:    { backgroundColor: colors.white, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  tabText:      { fontSize: 14, fontWeight: '600', color: colors.textLight },
  tabTextActive:{ color: colors.textDark, fontWeight: '700' },

  formTitle: { fontSize: 22, fontWeight: '800', color: colors.textDark, marginBottom: spacing.md },

  inputHint: { fontSize: 12, color: colors.textLight, marginBottom: spacing.xs, marginLeft: 4 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.background, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, marginBottom: spacing.sm, paddingHorizontal: spacing.sm },
  inputIcon: { fontSize: 16, marginRight: spacing.xs, width: 24, textAlign: 'center' },
  input:     { flex: 1, paddingVertical: 14, fontSize: 16, color: colors.textDark },
  eyeBtn:    { padding: spacing.sm },
  eyeIcon:   { fontSize: 16 },

  errorWrap: { backgroundColor: '#FEF2F2', borderRadius: radius.sm, borderWidth: 1, borderColor: '#FCA5A5', padding: spacing.sm, marginBottom: spacing.sm },
  errorText: { fontSize: 13, color: '#DC2626', lineHeight: 18 },

  submitBtn:         { backgroundColor: colors.green, borderRadius: radius.pill, paddingVertical: 16, alignItems: 'center', marginTop: spacing.xs },
  submitBtnDisabled: { opacity: 0.6 },
  submitText:        { color: colors.white, fontWeight: '800', fontSize: 16, letterSpacing: 0.3 },

  divider:     { flexDirection: 'row', alignItems: 'center', marginVertical: spacing.md },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { color: colors.textLight, fontSize: 13, marginHorizontal: spacing.sm },

  skipBtn:  { backgroundColor: colors.background, borderRadius: radius.pill, paddingVertical: 14, alignItems: 'center', borderWidth: 1.5, borderColor: colors.border },
  skipText: { color: colors.textMid, fontWeight: '600', fontSize: 15 },

  terms: { fontSize: 11, color: colors.textLight, textAlign: 'center', marginTop: spacing.md, lineHeight: 16 },

  forgotLink:     { alignSelf: 'flex-end', marginBottom: spacing.xs, marginTop: -spacing.xs },
  forgotLinkText: { fontSize: 13, color: colors.green, fontWeight: '600' },

  googleBtn:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.pill, paddingVertical: 14, gap: spacing.sm, backgroundColor: colors.white },
  googleBtnIcon:  { fontSize: 16, fontWeight: '900', color: '#4285F4', width: 22, textAlign: 'center' },
  googleBtnText:  { fontSize: 15, fontWeight: '700', color: colors.textDark },

  backLink:      { alignItems: 'center', marginTop: spacing.md },
  backLinkText:  { fontSize: 14, color: colors.green, fontWeight: '600' },

  successWrap:  { backgroundColor: '#F0FDF4', borderRadius: radius.sm, borderWidth: 1, borderColor: '#86EFAC', padding: spacing.md, marginBottom: spacing.md },
  successText:  { fontSize: 14, color: '#15803D', lineHeight: 20 },

  // Plan picker
  planHeading: { fontSize: 22, fontWeight: '800', color: colors.textDark, marginBottom: 4 },
  planSub:     { fontSize: 14, color: colors.textLight, marginBottom: spacing.lg },
  planSection: { fontSize: 12, fontWeight: '600', color: colors.textMid, marginBottom: spacing.xs, marginTop: spacing.xs },

  planCard:    { borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.border, padding: spacing.md, marginBottom: spacing.md },
  planCardPro: { backgroundColor: colors.green, borderColor: colors.green },

  planCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.sm },
  planName:       { fontSize: 20, fontWeight: '900', color: colors.textDark },
  planPrice:      { fontSize: 15, fontWeight: '700', color: colors.textDark, textAlign: 'right' },
  planPriceAlt:   { fontSize: 12, color: 'rgba(255,255,255,0.6)', textAlign: 'right', marginTop: 2 },

  proBadge:     { backgroundColor: colors.gold, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3, alignSelf: 'flex-start', marginBottom: spacing.sm },
  proBadgeText: { fontSize: 10, fontWeight: '800', color: colors.white, letterSpacing: 0.8 },

  featureRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs, gap: spacing.sm },
  featureText:{ fontSize: 14, color: colors.textDark, flex: 1, lineHeight: 20 },

  check:    { width: 20, height: 20, borderRadius: 10, backgroundColor: '#E8F5EE', justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  checkPro: { backgroundColor: 'rgba(255,255,255,0.25)' },
  checkMark:{ fontSize: 11, fontWeight: '900', color: colors.green },

  planCta:     { borderRadius: radius.pill, paddingVertical: 13, alignItems: 'center', marginTop: spacing.md },
  planCtaFree: { backgroundColor: colors.background, borderWidth: 1.5, borderColor: colors.green },
  planCtaPro:  { backgroundColor: colors.white },
  planCtaText: { fontWeight: '800', fontSize: 15 },

  planDesc:     { fontSize: 13, color: 'rgba(255,255,255,0.85)', lineHeight: 19, marginBottom: spacing.xs },
  planPer:      { fontSize: 13, fontWeight: '400' },
  planFootnote: { fontSize: 11, color: colors.textLight, textAlign: 'center', marginTop: spacing.sm, lineHeight: 16 },

  // Welcome nudge
  upgradeNudge:      { backgroundColor: '#FFF9E6', borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.gold, padding: spacing.md, marginTop: spacing.lg, marginBottom: spacing.md },
  upgradeNudgeTitle: { fontSize: 15, fontWeight: '800', color: colors.gold, marginBottom: 4 },
  upgradeNudgeBody:  { fontSize: 13, color: colors.textMid, lineHeight: 20, marginBottom: spacing.md },
  upgradeNudgeBtn:   { backgroundColor: colors.gold, borderRadius: radius.pill, paddingVertical: 11, alignItems: 'center' },
  upgradeNudgeBtnText:{ color: colors.white, fontWeight: '800', fontSize: 14 },
});
