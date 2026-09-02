import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Verify calling user is a center_owner
    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await userClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { email, full_name, role, center_id, rci_registration_number, credential_class, phone_e164, discipline_id } = body;

    if (!email || !full_name || !role || !center_id) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Therapist and supervising_therapist roles require a discipline
    const needsDiscipline = role === 'therapist' || role === 'supervising_therapist';
    if (needsDiscipline && !discipline_id) {
      return new Response(JSON.stringify({ error: 'discipline_id is required for therapist roles' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate discipline_id if provided
    if (discipline_id) {
      const { data: disc } = await adminClient
        .from('disciplines')
        .select('id')
        .eq('id', discipline_id)
        .eq('is_active', true)
        .single();
      if (!disc) {
        return new Response(JSON.stringify({ error: 'Invalid or inactive discipline_id' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Verify caller is center_owner of this center
    const { data: callerMembership } = await adminClient
      .from('memberships')
      .select('role')
      .eq('user_id', caller.id)
      .eq('center_id', center_id)
      .eq('is_active', true)
      .single();

    if (!callerMembership || callerMembership.role !== 'center_owner') {
      return new Response(JSON.stringify({ error: 'Only center owners can invite therapists' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Invite user by email
    const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email);
    if (inviteError) {
      const msg = inviteError.message.toLowerCase();
      if (msg.includes('already') || msg.includes('duplicate')) {
        return new Response(JSON.stringify({ error: 'duplicate email' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ error: inviteError.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const newUserId = inviteData.user.id;

    // Create profile
    await adminClient.from('profiles').upsert({
      id: newUserId,
      full_name,
      phone_e164: phone_e164 || null,
      rci_registration_number: rci_registration_number || null,
      credential_class: credential_class || null,
      discipline_id: discipline_id || null,
    }, { onConflict: 'id' });

    // Create membership
    await adminClient.from('memberships').insert({
      user_id: newUserId,
      center_id,
      role,
      is_active: true,
    });

    // Audit log
    await adminClient.from('audit_log').insert({
      action: 'membership.invited',
      actor_id: caller.id,
      center_id,
      entity_id: newUserId,
      entity_type: 'profile',
    });

    return new Response(JSON.stringify({ user_id: newUserId }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
