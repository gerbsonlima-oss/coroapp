-- Add tenant_id to event_songs
ALTER TABLE event_songs 
ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

-- Backfill existing data
UPDATE event_songs SET tenant_id = (
  SELECT tenant_id FROM events WHERE events.id = event_songs.event_id
);

-- Make it NOT NULL after backfill
ALTER TABLE event_songs ALTER COLUMN tenant_id SET NOT NULL;

-- Add index
CREATE INDEX idx_event_songs_tenant ON event_songs(tenant_id);
CREATE INDEX idx_event_songs_tenant_event ON event_songs(tenant_id, event_id);

---

-- Add tenant_id to event_song_types
ALTER TABLE event_song_types 
ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

UPDATE event_song_types SET tenant_id = (
  SELECT tenant_id FROM events WHERE events.id = event_song_types.event_id
);

ALTER TABLE event_song_types ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX idx_event_song_types_tenant ON event_song_types(tenant_id);
CREATE INDEX idx_event_song_types_tenant_event ON event_song_types(tenant_id, event_id);

---

-- Add tenant_id to rehearsal_attendance
ALTER TABLE rehearsal_attendance 
ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

UPDATE rehearsal_attendance SET tenant_id = (
  SELECT tenant_id FROM rehearsals WHERE rehearsals.id = rehearsal_attendance.rehearsal_id
);

ALTER TABLE rehearsal_attendance ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX idx_rehearsal_attendance_tenant ON rehearsal_attendance(tenant_id);
CREATE INDEX idx_rehearsal_attendance_tenant_rehearsal ON rehearsal_attendance(tenant_id, rehearsal_id);