/**
 * Integration test: session ownership guard.
 *
 * Proves:
 * 1. A user CAN read/update their own session (therapist_id = self).
 * 2. A user CANNOT update a session owned by a different therapist
 *    (unless they are center_owner/supervising_therapist of that center).
 * 3. A second user (therapist) in the same center CANNOT update
 *    a session they don't own.
 *
 * This mirrors the guard in SessionRun.tsx which checks
 * session.therapist_id === user.id before allowing the run.
 *
 * Run: npx vitest run src/__integration__/session-ownership-guard.test.ts
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { describe, it, expect, afterAll } from 'vitest';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const RUN_ID = Date.now().toString(36);

// User A: center owner + therapist on the session
const USER_A_EMAIL = `test+guard-a-${RUN_ID}@habilitatelabs.com`;
// User B: second therapist, invited to the same center
const USER_B_EMAIL = `test+guard-b-${RUN_ID}@habilitatelabs.com`;
const PASSWORD = 'TestPass123!';

let sbA: SupabaseClient;
let sbB: SupabaseClient;
let userAId: string;
let userBId: string;
let centerId: string;
let childId: string;
let sessionId: string;

describe('Session ownership guard (live Supabase)', () => {
  // ─── Setup: create User A (owner), center, child, session ─────────
  it('Setup: User A signs up, creates center + child + session', async () => {
    sbA = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    const { data: signupA } = await sbA.auth.signUp({
      email: USER_A_EMAIL,
      password: PASSWORD,
      options: { data: { full_name: `Guard Owner ${RUN_ID}` } },
    });
    expect(signupA.session).toBeTruthy();
    userAId = signupA.user!.id;

    // Create center
    const { error: rpcErr } = await sbA.rpc('create_center_with_owner', {
      p_name: `Guard Center ${RUN_ID}`,
    });
    expect(rpcErr).toBeNull();

    // Get centerId from membership
    const { data: mems } = await sbA.from('memberships').select('center_id, role')
      .eq('user_id', userAId).eq('is_active', true);
    centerId = mems!.find((m) => m.role === 'center_owner')!.center_id;

    // Create child
    const { data: child } = await sbA.from('children').insert({
      center_id: centerId,
      full_name: `Guard Child ${RUN_ID}`,
      date_of_birth: '2022-06-01',
      diagnostic_profile: ['autism'],
      primary_therapist_id: userAId,
    }).select('id').single();
    childId = child!.id;

    // Create session owned by User A
    const { data: sess, error: sessErr } = await sbA.from('sessions').insert({
      center_id: centerId,
      child_id: childId,
      therapist_id: userAId,
      scheduled_date: new Date().toISOString().slice(0, 10),
      scheduled_time: '11:00',
      status: 'scheduled',
    }).select('id').single();
    expect(sessErr).toBeNull();
    sessionId = sess!.id;
  }, 20_000);

  // ─── Setup: create User B (therapist), add to center ──────────────
  it('Setup: User B signs up, added to center as therapist', async () => {
    sbB = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    const { data: signupB } = await sbB.auth.signUp({
      email: USER_B_EMAIL,
      password: PASSWORD,
      options: { data: { full_name: `Guard Therapist ${RUN_ID}` } },
    });
    expect(signupB.session).toBeTruthy();
    userBId = signupB.user!.id;

    // User A (owner) adds User B as therapist
    const { error: memErr } = await sbA.from('memberships').insert({
      user_id: userBId,
      center_id: centerId,
      role: 'therapist',
      is_active: true,
    });
    expect(memErr).toBeNull();
  }, 15_000);

  // ─── Test: User A (owner) CAN read their own session ──────────────
  it('ALLOWED: User A reads their own session', async () => {
    const { data, error } = await sbA.from('sessions')
      .select('id, therapist_id, status')
      .eq('id', sessionId)
      .single();

    expect(error).toBeNull();
    expect(data!.therapist_id).toBe(userAId);
  }, 10_000);

  // ─── Test: User A (owner) CAN update their own session ────────────
  it('ALLOWED: User A updates their own session (start)', async () => {
    const { error } = await sbA.from('sessions')
      .update({
        status: 'in_progress',
        started_at: new Date().toISOString(),
      })
      .eq('id', sessionId);

    expect(error).toBeNull();

    // Verify
    const { data } = await sbA.from('sessions')
      .select('status').eq('id', sessionId).single();
    expect(data!.status).toBe('in_progress');
  }, 10_000);

  // ─── Test: User B (therapist) CAN read the session ────────────────
  it('ALLOWED: User B can read sessions in their center', async () => {
    const { data, error } = await sbB.from('sessions')
      .select('id, therapist_id')
      .eq('id', sessionId)
      .single();

    expect(error).toBeNull();
    expect(data!.therapist_id).toBe(userAId);
  }, 10_000);

  // ─── Test: User B CANNOT update User A's session ──────────────────
  it('BLOCKED: User B cannot update a session they do not own', async () => {
    // Reset to scheduled first (as owner)
    await sbA.from('sessions').update({ status: 'scheduled', started_at: null })
      .eq('id', sessionId);

    // User B tries to start it — RLS blocks the update silently (zero rows affected)
    await sbB.from('sessions')
      .update({
        status: 'in_progress',
        started_at: new Date().toISOString(),
      })
      .eq('id', sessionId);

    // Verify the session was NOT changed.
    const { data } = await sbA.from('sessions')
      .select('status').eq('id', sessionId).single();

    expect(data!.status).toBe('scheduled');
  }, 10_000);

  // ─── Test: frontend guard logic (pure function) ───────────────────
  it('Guard logic: allowed when therapist_id matches, blocked otherwise', () => {
    // Simulate the guard variables from SessionRun.tsx
    function evaluateGuard(authLoading: boolean, userId: string | null, therapistId: string) {
      const guardLoading = authLoading || !userId;
      const guardAllowed = !guardLoading && therapistId === userId;
      const guardBlocked = !guardLoading && therapistId !== userId;
      return { guardLoading, guardAllowed, guardBlocked };
    }

    // Auth still loading → loading, NOT blocked
    expect(evaluateGuard(true, null, 'abc')).toEqual({
      guardLoading: true, guardAllowed: false, guardBlocked: false,
    });

    // Auth loaded, user is null → loading, NOT blocked
    expect(evaluateGuard(false, null, 'abc')).toEqual({
      guardLoading: true, guardAllowed: false, guardBlocked: false,
    });

    // Auth loaded, user matches → allowed
    expect(evaluateGuard(false, 'abc', 'abc')).toEqual({
      guardLoading: false, guardAllowed: true, guardBlocked: false,
    });

    // Auth loaded, user differs → blocked
    expect(evaluateGuard(false, 'xyz', 'abc')).toEqual({
      guardLoading: false, guardAllowed: false, guardBlocked: true,
    });
  });

  // ─── Cleanup ──────────────────────────────────────────────────────
  afterAll(async () => {
    try {
      if (sessionId) {
        await sbA.from('audit_log').delete().eq('entity_id', sessionId);
        await sbA.from('sessions').delete().eq('id', sessionId);
      }
      if (childId) await sbA.from('children').delete().eq('id', childId);
      if (centerId) {
        await sbA.from('memberships').delete().eq('center_id', centerId);
        await sbA.from('centers').delete().eq('id', centerId);
      }
    } catch { /* best-effort */ }
  }, 30_000);
});
