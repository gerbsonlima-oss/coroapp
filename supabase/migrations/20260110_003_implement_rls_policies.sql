-- Enable RLS on all tenant-scoped tables
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE song_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE song_audios ENABLE ROW LEVEL SECURITY;
ALTER TABLE rehearsals ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_song_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE rehearsal_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- EVENTS POLICIES
CREATE POLICY "Users can view events in their tenant"
ON events FOR SELECT
USING (
  tenant_id = (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role = 'super_admin'
  )
);

CREATE POLICY "Admins can insert events in their tenant"
ON events FOR INSERT
WITH CHECK (
  tenant_id = (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  )
  AND EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND (role = 'admin' OR role = 'super_admin')
    AND (role = 'super_admin' OR tenant_id = events.tenant_id)
  )
);

CREATE POLICY "Admins can update events in their tenant"
ON events FOR UPDATE
USING (
  tenant_id = (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  )
  AND EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND (role = 'admin' OR role = 'super_admin')
    AND (role = 'super_admin' OR tenant_id = events.tenant_id)
  )
);

CREATE POLICY "Admins can delete events in their tenant"
ON events FOR DELETE
USING (
  tenant_id = (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  )
  AND EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND (role = 'admin' OR role = 'super_admin')
    AND (role = 'super_admin' OR tenant_id = events.tenant_id)
  )
);

-- SONGS POLICIES
CREATE POLICY "Users can view songs in their tenant"
ON songs FOR SELECT
USING (
  tenant_id = (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role = 'super_admin'
  )
);

CREATE POLICY "Admins can insert songs in their tenant"
ON songs FOR INSERT
WITH CHECK (
  tenant_id = (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  )
  AND EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND (role = 'admin' OR role = 'super_admin')
    AND (role = 'super_admin' OR tenant_id = songs.tenant_id)
  )
);

CREATE POLICY "Admins can update songs in their tenant"
ON songs FOR UPDATE
USING (
  tenant_id = (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  )
  AND EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND (role = 'admin' OR role = 'super_admin')
    AND (role = 'super_admin' OR tenant_id = songs.tenant_id)
  )
);

CREATE POLICY "Admins can delete songs in their tenant"
ON songs FOR DELETE
USING (
  tenant_id = (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  )
  AND EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND (role = 'admin' OR role = 'super_admin')
    AND (role = 'super_admin' OR tenant_id = songs.tenant_id)
  )
);

-- SONG_TYPES POLICIES
CREATE POLICY "Users can view song_types in their tenant"
ON song_types FOR SELECT
USING (
  tenant_id = (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role = 'super_admin'
  )
);

CREATE POLICY "Admins can manage song_types in their tenant"
ON song_types FOR ALL
USING (
  tenant_id = (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  )
  AND EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND (role = 'admin' OR role = 'super_admin')
    AND (role = 'super_admin' OR tenant_id = song_types.tenant_id)
  )
);

-- SONG_AUDIOS POLICIES
CREATE POLICY "Users can view song_audios in their tenant"
ON song_audios FOR SELECT
USING (
  tenant_id = (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role = 'super_admin'
  )
);

CREATE POLICY "Admins can manage song_audios in their tenant"
ON song_audios FOR ALL
USING (
  tenant_id = (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  )
  AND EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND (role = 'admin' OR role = 'super_admin')
    AND (role = 'super_admin' OR tenant_id = song_audios.tenant_id)
  )
);

-- REHEARSALS POLICIES
CREATE POLICY "Users can view rehearsals in their tenant"
ON rehearsals FOR SELECT
USING (
  tenant_id = (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role = 'super_admin'
  )
);

CREATE POLICY "Admins can manage rehearsals in their tenant"
ON rehearsals FOR ALL
USING (
  tenant_id = (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  )
  AND EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND (role = 'admin' OR role = 'super_admin')
    AND (role = 'super_admin' OR tenant_id = rehearsals.tenant_id)
  )
);

-- EVENT_SONGS POLICIES
CREATE POLICY "Users can view event_songs in their tenant"
ON event_songs FOR SELECT
USING (
  tenant_id = (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role = 'super_admin'
  )
);

CREATE POLICY "Admins can manage event_songs in their tenant"
ON event_songs FOR ALL
USING (
  tenant_id = (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  )
  AND EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND (role = 'admin' OR role = 'super_admin')
    AND (role = 'super_admin' OR tenant_id = event_songs.tenant_id)
  )
);

-- EVENT_SONG_TYPES POLICIES
CREATE POLICY "Users can view event_song_types in their tenant"
ON event_song_types FOR SELECT
USING (
  tenant_id = (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role = 'super_admin'
  )
);

CREATE POLICY "Admins can manage event_song_types in their tenant"
ON event_song_types FOR ALL
USING (
  tenant_id = (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  )
  AND EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND (role = 'admin' OR role = 'super_admin')
    AND (role = 'super_admin' OR tenant_id = event_song_types.tenant_id)
  )
);

-- REHEARSAL_ATTENDANCE POLICIES
CREATE POLICY "Users can view rehearsal_attendance in their tenant"
ON rehearsal_attendance FOR SELECT
USING (
  tenant_id = (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND role = 'super_admin'
  )
);

CREATE POLICY "Admins can manage rehearsal_attendance in their tenant"
ON rehearsal_attendance FOR ALL
USING (
  tenant_id = (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  )
  AND EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = auth.uid()
    AND (role = 'admin' OR role = 'super_admin')
    AND (role = 'super_admin' OR tenant_id = rehearsal_attendance.tenant_id)
  )
);

-- USER_ROLES POLICIES
CREATE POLICY "Users can view user_roles in their tenant"
ON user_roles FOR SELECT
USING (
  tenant_id = (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role = 'super_admin'
  )
);

CREATE POLICY "Admins can manage user_roles in their tenant"
ON user_roles FOR ALL
USING (
  tenant_id = (
    SELECT tenant_id FROM profiles WHERE id = auth.uid()
  )
  AND EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
    AND (ur.role = 'admin' OR ur.role = 'super_admin')
    AND (ur.role = 'super_admin' OR ur.tenant_id = user_roles.tenant_id)
  )
);