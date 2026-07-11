import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Modal,
  ScrollView, StyleSheet, ActivityIndicator, Linking, Platform,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { colors, spacing, radius } from '../utils/theme';

const STRIPE_PORTAL = 'https://billing.stripe.com/p/login/REPLACE_PORTAL';

function initials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return parts.length === 1
    ? parts[0].slice(0, 2).toUpperCase()
    : (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function Row({ label, value }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value || '—'}</Text>
    </View>
  );
}

export default function AccountMenu({ onSignIn, size = 36 }) {
  const { user, profile, signOut, updateProfile } = useAuth();
  const [visible, setVisible]   = useState(false);
  const [editing, setEditing]   = useState(false);
  const [busy, setBusy]         = useState(false);
  const [error, setError]       = useState('');
  const [saved, setSaved]       = useState(false);

  const [fullName,     setFullName]     = useState('');
  const [scoringName,  setScoringName]  = useState('');
  const [email,        setEmail]        = useState('');

  const displayName = profile?.scoring_name || profile?.display_name || user?.email || 'Guest';

  function openAccount() {
    setFullName(profile?.full_name || '');
    setScoringName(profile?.scoring_name || profile?.display_name || '');
    setEmail(user?.email || '');
    setEditing(false);
    setError('');
    setSaved(false);
    setVisible(true);
  }

  async function saveProfile() {
    if (!fullName.trim() || !scoringName.trim()) { setError('Name and scoring name are required.'); return; }
    setBusy(true);
    setError('');
    try {
      await updateProfile({
        full_name: fullName.trim(),
        scoring_name: scoringName.trim(),
        display_name: scoringName.trim(),
      });
      setSaved(true);
      setEditing(false);
    } catch (e) {
      setError(e.message || 'Failed to save.');
    } finally {
      setBusy(false);
    }
  }

  function openBilling() {
    if (Platform.OS === 'web') {
      window.open(STRIPE_PORTAL, '_blank');
    } else {
      Linking.openURL(STRIPE_PORTAL);
    }
  }

  return (
    <>
      <TouchableOpacity
        style={[styles.avatarBtn, { width: size, height: size, borderRadius: size / 2 }]}
        onPress={() => (user ? openAccount() : onSignIn?.())}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text style={[styles.avatarText, { fontSize: size * 0.36 }]}>
          {user ? initials(displayName) : '?'}
        </Text>
      </TouchableOpacity>

      <Modal visible={visible} animationType="slide" onRequestClose={() => setVisible(false)}>
        <View style={styles.root}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => setVisible(false)} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>My Account</Text>
            <View style={{ width: 36 }} />
          </View>

          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            {/* Avatar block */}
            <View style={styles.avatarBlock}>
              <View style={styles.bigAvatar}>
                <Text style={styles.bigAvatarText}>{initials(displayName)}</Text>
              </View>
              <Text style={styles.bigName}>{displayName}</Text>
              <Text style={styles.bigEmail}>{user?.email}</Text>
            </View>

            {/* Profile section */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Profile</Text>
                {!editing && (
                  <TouchableOpacity onPress={() => { setEditing(true); setSaved(false); }}>
                    <Text style={styles.editLink}>Edit</Text>
                  </TouchableOpacity>
                )}
              </View>

              {editing ? (
                <>
                  <Text style={styles.fieldLabel}>Full name</Text>
                  <TextInput
                    style={styles.input}
                    value={fullName}
                    onChangeText={setFullName}
                    placeholder="John Smith"
                    placeholderTextColor={colors.textLight}
                    autoCapitalize="words"
                  />
                  <Text style={styles.fieldLabel}>Scoring name <Text style={styles.fieldHint}>(shown on leaderboard)</Text></Text>
                  <TextInput
                    style={styles.input}
                    value={scoringName}
                    onChangeText={setScoringName}
                    placeholder='e.g. "Ace" or "JQ"'
                    placeholderTextColor={colors.textLight}
                    autoCapitalize="words"
                  />
                  <Text style={styles.fieldLabel}>Email</Text>
                  <TextInput
                    style={[styles.input, styles.inputDisabled]}
                    value={email}
                    editable={false}
                  />
                  <Text style={styles.fieldHint}>To change your email contact support@teewager.io</Text>

                  {!!error && <Text style={styles.errorText}>⚠️ {error}</Text>}
                  {!!saved && <Text style={styles.savedText}>✓ Saved!</Text>}

                  <View style={styles.editBtns}>
                    <TouchableOpacity style={styles.cancelBtn} onPress={() => { setEditing(false); setError(''); }}>
                      <Text style={styles.cancelBtnText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.saveBtn} onPress={saveProfile} disabled={busy}>
                      {busy ? <ActivityIndicator color={colors.white} /> : <Text style={styles.saveBtnText}>Save changes</Text>}
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <>
                  {!!saved && <Text style={styles.savedText}>✓ Profile updated!</Text>}
                  <Row label="Full name"     value={profile?.full_name} />
                  <Row label="Scoring name"  value={profile?.scoring_name || profile?.display_name} />
                  <Row label="Email"         value={user?.email} />
                </>
              )}
            </View>

            {/* Billing section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Billing</Text>
              <View style={styles.planChip}>
                <Text style={styles.planChipLabel}>Current plan</Text>
                <Text style={styles.planChipValue}>Free</Text>
              </View>
              <TouchableOpacity style={styles.billingBtn} onPress={openBilling} activeOpacity={0.85}>
                <Text style={styles.billingBtnIcon}>💳</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.billingBtnText}>Manage billing</Text>
                  <Text style={styles.billingBtnSub}>Upgrade, cancel, or view invoices</Text>
                </View>
                <Text style={styles.billingChevron}>›</Text>
              </TouchableOpacity>
            </View>

            {/* Support */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Support</Text>
              <TouchableOpacity style={styles.supportRow} onPress={() => Linking.openURL('mailto:support@teewager.io')}>
                <Text style={styles.supportIcon}>✉️</Text>
                <Text style={styles.supportText}>support@teewager.io</Text>
              </TouchableOpacity>
            </View>

            {/* Sign out */}
            <TouchableOpacity
              style={styles.signOutBtn}
              onPress={async () => { setVisible(false); await signOut(); }}
              activeOpacity={0.85}
            >
              <Text style={styles.signOutText}>Sign Out</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  avatarBtn:    { backgroundColor: 'rgba(255,255,255,0.2)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.5)', justifyContent: 'center', alignItems: 'center' },
  avatarText:   { color: colors.white, fontWeight: '800' },

  root:         { flex: 1, backgroundColor: colors.background },

  header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.green, paddingTop: 56, paddingBottom: 16, paddingHorizontal: spacing.md },
  headerTitle:  { fontSize: 18, fontWeight: '800', color: colors.white },
  closeBtn:     { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  closeBtnText: { color: colors.white, fontSize: 16, fontWeight: '700' },

  content:      { padding: spacing.md, paddingBottom: 48 },

  avatarBlock:  { alignItems: 'center', paddingVertical: spacing.lg },
  bigAvatar:    { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.green, justifyContent: 'center', alignItems: 'center', marginBottom: spacing.sm },
  bigAvatarText:{ color: colors.white, fontWeight: '900', fontSize: 26 },
  bigName:      { fontSize: 22, fontWeight: '800', color: colors.textDark },
  bigEmail:     { fontSize: 13, color: colors.textLight, marginTop: 2 },

  section:       { backgroundColor: colors.white, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.border },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.sm },
  sectionTitle:  { fontSize: 12, fontWeight: '700', color: colors.textLight, textTransform: 'uppercase', letterSpacing: 0.6 },
  editLink:      { fontSize: 14, fontWeight: '700', color: colors.green },

  infoRow:       { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: colors.border },
  infoLabel:     { fontSize: 14, color: colors.textMid },
  infoValue:     { fontSize: 14, fontWeight: '600', color: colors.textDark, maxWidth: '55%', textAlign: 'right' },

  fieldLabel:    { fontSize: 12, fontWeight: '700', color: colors.textMid, marginBottom: 4, marginTop: spacing.sm },
  fieldHint:     { fontSize: 11, color: colors.textLight, marginBottom: spacing.xs },
  input:         { backgroundColor: colors.background, borderRadius: radius.sm, borderWidth: 1.5, borderColor: colors.border, padding: 13, fontSize: 15, color: colors.textDark, marginBottom: spacing.xs },
  inputDisabled: { opacity: 0.5 },

  errorText:     { fontSize: 13, color: '#DC2626', marginTop: spacing.xs },
  savedText:     { fontSize: 13, color: colors.green, fontWeight: '700', marginTop: spacing.xs, marginBottom: spacing.xs },

  editBtns:      { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  cancelBtn:     { flex: 1, paddingVertical: 13, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.border, alignItems: 'center' },
  cancelBtnText: { fontSize: 15, fontWeight: '600', color: colors.textMid },
  saveBtn:       { flex: 2, paddingVertical: 13, borderRadius: radius.pill, backgroundColor: colors.green, alignItems: 'center' },
  saveBtnText:   { fontSize: 15, fontWeight: '800', color: colors.white },

  planChip:      { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: colors.background, borderRadius: radius.sm, padding: 12, marginBottom: spacing.sm },
  planChipLabel: { fontSize: 14, color: colors.textMid },
  planChipValue: { fontSize: 14, fontWeight: '700', color: colors.textDark },

  billingBtn:    { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.background, borderRadius: radius.sm, padding: 13 },
  billingBtnIcon:{ fontSize: 20 },
  billingBtnText:{ fontSize: 15, fontWeight: '700', color: colors.textDark },
  billingBtnSub: { fontSize: 12, color: colors.textLight, marginTop: 1 },
  billingChevron:{ fontSize: 22, color: colors.textLight, fontWeight: '300' },

  supportRow:    { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs },
  supportIcon:   { fontSize: 18 },
  supportText:   { fontSize: 14, color: colors.green, fontWeight: '600' },

  signOutBtn:    { backgroundColor: '#FEF2F2', borderRadius: radius.md, paddingVertical: 15, alignItems: 'center', borderWidth: 1, borderColor: '#FCA5A5' },
  signOutText:   { fontSize: 16, fontWeight: '700', color: '#DC2626' },
});
