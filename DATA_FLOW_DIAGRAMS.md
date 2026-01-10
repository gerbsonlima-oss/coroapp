# Data Flow Diagrams - Multi-Tenant Architecture

## 1. User Authentication & Tenant Association

```
┌─────────────────────────────────────────────────────────────────┐
│                      SIGN UP FLOW                               │
└─────────────────────────────────────────────────────────────────┘

USER VISITS /auth
   ↓
[Auth Page]
   ├─ Detect tenant from:
   │  ├─ getTenantSlugFromHostname() → "quixada"
   │  ├─ or default to "quixada"
   └─ Display tenant name & logo
   
USER ENTERS EMAIL/PASSWORD + PROFILE DATA
   ↓
[useAuth.tsx - signUp()]
   ├─ Call: supabase.auth.signUp()
   │  ├─ email, password
   │  ├─ metadata: {
   │  │    full_name: "João Silva",
   │  │    tenant_slug: "quixada"  ← IMPORTANT: Tenant in metadata
   │  │  }
   │  └─ redirectUrl: https://app.com/
   │
   ├─ Auth.users row created (global)
   │
   └─ Update auth.user metadata
   
SUPABASE TRIGGER on auth.users.insert
   ├─ Create profiles row:
   │  ├─ id: (from auth.users.id)
   │  ├─ email: (from auth.users.email)
   │  ├─ tenant_id: (lookup from tenant slug in metadata)
   │  ├─ full_name: (from metadata)
   │  └─ created_at: NOW()
   │
   └─ Create user_roles row:
      ├─ user_id: (from auth.users.id)
      ├─ tenant_id: (from tenants lookup)
      ├─ role: 'user'  ← Default role
      └─ created_at: NOW()

REDIRECT TO /(quixada)/
   ↓
TenantContext detects tenant:
   ├─ URL path: /(quixada)/ ✓
   └─ Sets: tenantSlug="quixada", tenantId="uuid-1234"

USER LOGGED IN & ASSOCIATED WITH TENANT ✓
```

---

## 2. User Login & Session Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                      SIGN IN FLOW                               │
└─────────────────────────────────────────────────────────────────┘

USER VISITS /(quixada)/
   ↓
[TenantProvider] Detects tenant from URL
   ├─ Fetch: SELECT * FROM tenants WHERE slug = 'quixada'
   └─ Sets: TenantContext with tenantId
   
[AuthProvider] Checks session
   ├─ Call: supabase.auth.getSession()
   └─ Sets: user = null (not logged in)
   
REDIRECT TO /auth
   ↓
USER ENTERS EMAIL/PASSWORD
   ↓
[useAuth.signIn()]
   ├─ Call: supabase.auth.signInWithPassword()
   │  ├─ email: "joao@example.com"
   │  └─ password: "***"
   │
   ├─ Supabase validates credentials
   │  └─ Returns: session { access_token, user }
   │
   └─ Frontend stores: session in localStorage (Supabase handles)

AuthProvider.onAuthStateChange() triggers
   ├─ Sets: user = {...}
   └─ Triggers re-render
   
[useIsAdmin()] Hook checks role
   ├─ Call: supabase.rpc('is_tenant_admin', {
   │    _user_id: user.id,
   │    _tenant_id: tenantId
   │  })
   │
   └─ Returns: boolean
   
REDIRECT TO /(quixada)/
   ↓
[Protected Routes] can now render
   ├─ useAuth().user exists ✓
   └─ useIsAdmin().isAdmin = true ✓

SESSION PERSISTS
   ├─ Browser has: access_token in localStorage
   ├─ Supabase auto-refreshes token
   └─ Subsequent requests include: Authorization: Bearer {token}
```

---

## 3. Querying Data - Single Tenant

```
┌─────────────────────────────────────────────────────────────────┐
│          GET SONGS FOR CURRENT TENANT                           │
└─────────────────────────────────────────────────────────────────┘

USER NAVIGATES TO /(quixada)/songs
   ↓
[Songs Page Component]
   ├─ const { tenantId } = useTenant()
   │  └─ Returns: "uuid-1234" (Quixadá's ID)
   │
   └─ useQuery hook or direct fetch
   
QUERY: Get songs
   ├─ Frontend:
   │  const { data } = await supabase
   │    .from("songs")
   │    .select("*")
   │    .eq("tenant_id", "uuid-1234")  ← MANDATORY
   │    .order("name");
   │
   ├─ Supabase receives query
   │
   ├─ [RLS POLICY CHECK]
   │  ├─ Is user authenticated? YES ✓
   │  ├─ User's tenant = "uuid-1234"? YES ✓
   │  ├─ Policy allows SELECT? YES ✓
   │  └─ Result: ALLOW query
   │
   └─ PostgreSQL executes:
      SELECT * FROM songs
      WHERE tenant_id = 'uuid-1234'
      ORDER BY name;

RESULTS RETURNED
   ├─ Only songs from Quixadá ✓
   ├─ Render in UI
   └─ Cache in React Query

WHAT IF USER TRIES DIFFERENT TENANT?
   ├─ URL: /(fortaleza)/songs
   │
   ├─ TenantContext updates: tenantId = "uuid-5678" (Fortaleza)
   │
   ├─ Query:
   │  const { data } = await supabase
   │    .from("songs")
   │    .select("*")
   │    .eq("tenant_id", "uuid-5678")  ← NOW DIFFERENT
   │    .order("name");
   │
   └─ [RLS POLICY CHECK]
      ├─ User's profile.tenant_id = "uuid-1234"
      ├─ Query filtering: tenant_id = "uuid-5678"
      ├─ MISMATCH! ✗
      ├─ Policy denies: User cannot see Fortaleza data
      └─ Result: 0 rows returned
```

---

## 4. Copy Data Between Tenants - SuperAdmin

```
┌─────────────────────────────────────────────────────────────────┐
│           COPY SONG TYPES: Quixadá → Fortaleza                 │
└─────────────────────────────────────────────────────────────────┘

SUPERADMIN VISITS /admin/tenants
   ↓
[AdminTenants Component]
   ├─ useAuth().user = superadmin user ✓
   ├─ useSuperAdmin().isSuperAdmin = true ✓
   └─ Show "Copy Data" button
   
SUPERADMIN CLICKS "COPY SONG TYPES"
   ↓
[Copy Dialog]
   ├─ Source: "Quixadá" (uuid-1234)
   ├─ Target: "Fortaleza" (uuid-5678)
   ├─ Items: [Introito, Gradual, Ofertório]
   └─ Click CONFIRM
   
FRONTEND CALLS EDGE FUNCTION
   ├─ POST /functions/v1/copy-tenant-data
   │
   ├─ Body:
   │  {
   │    sourceTenantId: "uuid-1234",
   │    targetTenantId: "uuid-5678",
   │    dataType: "songTypes",
   │    itemIds: ["type-1", "type-2", "type-3"]
   │  }
   │
   └─ Header: Authorization: Bearer {superadmin-token}

EDGE FUNCTION - VALIDATION
   ├─ Extract auth token
   │
   ├─ Call: supabase.auth.getUser(token)
   │  └─ Verify: token valid & user = superadmin
   │
   ├─ Call: supabase.rpc('is_super_admin', { _user_id: user.id })
   │  └─ Verify: user is SUPER_ADMIN (not just admin)
   │  └─ Reject if NOT super_admin ✗
   │
   └─ Access: Both tenants are valid

EDGE FUNCTION - COPY LOGIC
   ├─ For each songTypeId in itemIds:
   │
   │  1. Fetch from source:
   │     SELECT * FROM song_types
   │     WHERE id = ? AND tenant_id = 'uuid-1234'
   │     └─ If not found: ERROR
   │
   │  2. Create new in target:
   │     INSERT INTO song_types (
   │       id: NEW UUID,
   │       tenant_id: 'uuid-5678',  ← Different tenant!
   │       name: (from source),
   │       slug: (from source),
   │       description: (from source),
   │       order_index: (from source)
   │     )
   │     └─ Returns: new row with new ID
   │
   │  3. Store mapping: { old_id → new_id }
   │
   └─ Repeat for all items

EDGE FUNCTION - AUDIT
   ├─ INSERT INTO audit_logs:
   │  {
   │    user_id: superadmin.id,
   │    tenant_id: 'uuid-1234',  ← Source tenant
   │    action: 'copy_to_tenant',
   │    entity_type: 'songTypes',
   │    description: 'Copied 3 song types to Fortaleza',
   │    ip_address: request.ip,
   │    user_agent: request.user_agent
   │  }
   │
   └─ Log created ✓

RESPONSE TO FRONTEND
   ├─ {
   │    success: true,
   │    copied: 3,
   │    mapping: {
   │      "type-1": "new-uuid-1",
   │      "type-2": "new-uuid-2",
   │      "type-3": "new-uuid-3"
   │    }
   │  }
   │
   └─ Toast: "3 itens copiados com sucesso!"

RESULT
   ├─ Fortaleza now has song types with NEW IDs
   ├─ Data is NOT linked between tenants (independent copy)
   ├─ Each tenant can modify its copy independently
   └─ Audit trail shows who copied what and when ✓
```

---

## 5. Data Integrity - Junction Tables

```
┌─────────────────────────────────────────────────────────────────┐
│         EVENT SONGS: Ensuring Referential Integrity             │
└─────────────────────────────────────────────────────────────────┘

ADMIN ADDS SONG TO EVENT
   ├─ Event: "Missa Domingo" (event_id="evt-1", tenant_id="uuid-1234")
   ├─ Song: "Introito Laetatus" (song_id="sng-1", tenant_id="uuid-1234")
   ├─ Action: Add song to event
   │
   └─ INSERT INTO event_songs
      {
        event_songs: "evt-song-1",
        event_id: "evt-1",
        song_id: "sng-1",
        tenant_id: "uuid-1234",  ← MUST MATCH both event & song
        order_index: 1
      }

VALIDATION HAPPENS AT MULTIPLE LEVELS:

1. FRONTEND CHECK:
   ├─ event.tenant_id == useTenant().tenantId ✓
   ├─ song.tenant_id == useTenant().tenantId ✓
   └─ Show warning if mismatch

2. DATABASE LEVEL (RLS Policy):
   ├─ Policy checks: NEW.tenant_id = user's tenant ✓
   └─ Rejects INSERT if tenant_id mismatch

3. REFERENTIAL INTEGRITY (Foreign Keys):
   ├─ event_id must exist in events ✓
   ├─ song_id must exist in songs ✓
   └─ Both must have matching tenant_id (business logic)

WHAT IF CROSS-TENANT INSERTION ATTEMPTED?

User A (Quixadá):
   ├─ Tries: INSERT event_songs (evt-1, sng-2, uuid-5678)
   │         where sng-2 is from Fortaleza
   │
   ├─ Frontend:
   │  ├─ song.tenant_id = "uuid-5678"
   │  ├─ useTenant().tenantId = "uuid-1234"
   │  └─ MISMATCH! Show error ✗
   │
   └─ If bypassed and reaches DB:
      ├─ RLS Policy checks
      ├─ INSERT would target tenant_id = "uuid-1234"
      ├─ But referenced song is in "uuid-5678"
      └─ Potential for data corruption

SOLUTION: Constraint Trigger
   ├─ CREATE TRIGGER before insert on event_songs
   │  ├─ Check: event.tenant_id = NEW.tenant_id
   │  ├─ Check: song.tenant_id = NEW.tenant_id
   │  ├─ Reject if mismatch
   │  └─ Ensures cross-tenant refs impossible
   │
   └─ Plus RLS POLICY:
      CREATE POLICY "Enforce tenant consistency"
      ON event_songs FOR INSERT
      WITH CHECK (
        tenant_id = (SELECT tenant_id FROM events WHERE id = event_id)
        AND tenant_id = (SELECT tenant_id FROM songs WHERE id = song_id)
      );
```

---

## 6. Audit Trail Example

```
┌─────────────────────────────────────────────────────────────────┐
│              AUDIT LOG FOR DATA OPERATIONS                      │
└─────────────────────────────────────────────────────────────────┘

SEQUENCE OF EVENTS - Superadmin copies songs:

1. 2026-01-10 14:30:15 UTC
   ├─ user_id: superadmin-uuid
   ├─ tenant_id: uuid-1234 (Quixadá)
   ├─ action: "copy_to_tenant"
   ├─ entity_type: "songTypes"
   ├─ description: "Copied 5 song types to Fortaleza"
   └─ ip_address: 192.168.1.100

2. 2026-01-10 14:30:16 UTC
   ├─ user_id: superadmin-uuid
   ├─ tenant_id: uuid-1234 (Quixadá)
   ├─ action: "copy_to_tenant"
   ├─ entity_type: "songs"
   ├─ description: "Copied 45 songs + 135 audios to Fortaleza"
   └─ ip_address: 192.168.1.100

3. 2026-01-10 14:32:45 UTC (Fortaleza admin modifies copied data)
   ├─ user_id: fortaleza-admin-uuid
   ├─ tenant_id: uuid-5678 (Fortaleza)
   ├─ action: "update_song"
   ├─ entity_type: "song"
   ├─ entity_id: new-sng-5 (copied song)
   ├─ description: "Updated song name to fit Fortaleza style"
   ├─ changes: { name: { old: "Introito Laetatus", new: "Introito Veni Creator" } }
   └─ ip_address: 192.168.10.50

QUERY AUDIT LOGS:
   ├─ See who did what
   ├─ When it was done
   ├─ What changed
   ├─ From which IP
   └─ What user agent (mobile/web)

FORENSICS:
   ├─ Find all edits by specific user
   ├─ Find all copies between tenants
   ├─ Find suspicious bulk operations
   ├─ Track data lineage (what was copied from where)
   └─ Compliance documentation
```

---

## 7. Isolate Issue Detection

```
┌─────────────────────────────────────────────────────────────────┐
│         MONITORING: DETECT ISOLATION BREACHES                   │
└─────────────────────────────────────────────────────────────────┘

AUTOMATED CHECKS:

1. RLS Policy Violations
   ├─ Monitor PostgreSQL logs for:
   │  └─ "policy_violation" errors
   ├─ Alert if:
   │  ├─ User tries to access another tenant's data
   │  └─ More than 5 violations from same IP
   └─ Action: Block IP, investigate

2. Cross-Tenant Query Attempts
   ├─ Log all:
   │  ├─ SELECT * FROM songs (no tenant filter)
   │  ├─ UPDATE events WHERE id = X (missing tenant check)
   │  └─ DELETE songs WHERE user_id = X (insufficient scope)
   │
   └─ Alert if detected

3. Suspicious Bulk Operations
   ├─ Monitor for:
   │  ├─ 100+ INSERT/UPDATE in < 1 minute
   │  ├─ DELETE of > 50% of tenant's data
   │  └─ Unusual data volumes
   │
   └─ Require superadmin approval

4. Session Hijacking Detection
   ├─ Alert if:
   │  ├─ Same user from 2 IPs simultaneously
   │  ├─ User's tenant changed without logout
   │  └─ Unusual access patterns
   │
   └─ Force re-authentication

QUERY TO DETECT ISSUES:

SELECT 
  user_id,
  COUNT(*) as violation_count,
  MAX(created_at) as latest
FROM audit_logs
WHERE action = 'rls_violation'
GROUP BY user_id
HAVING COUNT(*) > 3
ORDER BY violation_count DESC;
```

---

## 8. Cascading Deletes - Data Cleanup

```
┌─────────────────────────────────────────────────────────────────┐
│      DELETE TENANT: Ensure all data is removed                  │
└─────────────────────────────────────────────────────────────────┘

SUPERADMIN DELETES TENANT: "Fortaleza"

CONSTRAINTS WITH ON DELETE CASCADE:

tenants (PK: id)
   ├─ ON DELETE CASCADE to:
   │  ├─ events (FK: tenant_id)
   │  │  ├─ ON DELETE CASCADE to:
   │  │  │  ├─ event_songs
   │  │  │  ├─ event_song_types
   │  │  │  └─ rehearsals
   │  │  │     └─ ON DELETE CASCADE to rehearsal_attendance
   │  │
   │  ├─ songs (FK: tenant_id)
   │  │  └─ ON DELETE CASCADE to song_audios
   │  │
   │  ├─ song_types (FK: tenant_id)
   │  │
   │  ├─ rehearsals (FK: tenant_id)
   │  │  └─ ON DELETE CASCADE to rehearsal_attendance
   │  │
   │  ├─ profiles (FK: tenant_id)
   │  │
   │  ├─ user_roles (FK: tenant_id)
   │  │
   │  └─ audit_logs (FK: tenant_id)

DELETE CASCADE SEQUENCE:

DELETE FROM tenants WHERE id = 'uuid-5678'
   ├─ PostgreSQL triggers cascade:
   │
   ├─ 1. Delete from event_songs where event in fortaleza
   ├─ 2. Delete from event_song_types where event in fortaleza
   ├─ 3. Delete from rehearsal_attendance where rehearsal in fortaleza
   ├─ 4. Delete from rehearsals where tenant_id = uuid-5678
   ├─ 5. Delete from events where tenant_id = uuid-5678
   ├─ 6. Delete from song_audios where song in fortaleza
   ├─ 7. Delete from songs where tenant_id = uuid-5678
   ├─ 8. Delete from song_types where tenant_id = uuid-5678
   ├─ 9. Delete from profiles where tenant_id = uuid-5678
   ├─ 10. Delete from user_roles where tenant_id = uuid-5678
   ├─ 11. Delete from audit_logs where tenant_id = uuid-5678
   │
   └─ 12. Finally delete from tenants where id = uuid-5678

RESULT:
   ├─ ALL Fortaleza data completely removed ✓
   ├─ Orphaned records impossible (CASCADE)
   ├─ Audit trail preserved (before DELETE)
   └─ Safe complete cleanup
```
