import { useEffect, useState } from 'react';
import {
  getMeetings,
  getMeeting,
  createMeeting,
  updateMeetingActionItemStatus,
} from '../api';
import { COLORS, STATUS_COLORS } from '../styles/design-system';

interface Attendee {
  name: string;
  role?: string;
}

interface ActionItem {
  description: string;
  assignee?: string;
  dueDate?: string;
  status?: 'open' | 'in_progress' | 'closed';
}

interface Meeting {
  id: string;
  projectId: string;
  title: string;
  meetingDate: string;
  location: string | null;
  facilitator: string | null;
  attendees: Attendee[] | null;
  agenda: string[] | null;
  minutes: string | null;
  actionItems: ActionItem[] | null;
  status: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

function MeetingList({
  meetings,
  onSelect,
  onCreateNew,
}: {
  meetings: Meeting[];
  onSelect: (m: Meeting) => void;
  onCreateNew: () => void;
}) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ margin: 0, fontSize: 18, color: COLORS.textPrimary }}>Meeting Minutes</h3>
        <button
          onClick={onCreateNew}
          style={{
            padding: '8px 16px',
            background: COLORS.orange,
            color: COLORS.white,
            border: 'none',
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          + New Meeting
        </button>
      </div>
      {meetings.length === 0 ? (
        <div
          style={{
            padding: 32,
            textAlign: 'center',
            background: COLORS.gray100,
            borderRadius: 8,
            color: COLORS.textMuted,
            fontSize: 13,
          }}
        >
          No meetings yet. Click "New Meeting" to record your first one.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {meetings.map((m) => {
            const openCount = (m.actionItems ?? []).filter(
              (a) => !a.status || a.status === 'open' || a.status === 'in_progress'
            ).length;
            return (
              <div
                key={m.id}
                onClick={() => onSelect(m)}
                style={{
                  padding: 16,
                  background: COLORS.white,
                  border: `1px solid ${COLORS.gray200}`,
                  borderRadius: 8,
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  transition: 'box-shadow 0.15s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.boxShadow = SHADOWS.small)}
                onMouseLeave={(e) => (e.currentTarget.style.boxShadow = 'none')}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.textPrimary, marginBottom: 4 }}>
                    {m.title}
                  </div>
                  <div style={{ fontSize: 12, color: COLORS.textSecondary }}>
                    {new Date(m.meetingDate).toLocaleDateString()} · {m.facilitator ?? '—'}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.navy }}>
                      {(m.actionItems ?? []).length}
                    </div>
                    <div style={{ fontSize: 10, color: COLORS.textMuted }}>Action Items</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 16, fontWeight: 700, color: openCount > 0 ? STATUS_COLORS.amber.bg : STATUS_COLORS.green.bg }}>
                      {openCount}
                    </div>
                    <div style={{ fontSize: 10, color: COLORS.textMuted }}>Open</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const SHADOWS = {
  small: '0 2px 8px rgba(0,0,0,0.08)',
};

function MeetingDetail({
  meeting,
  onBack,
  onUpdated,
}: {
  meeting: Meeting;
  onBack: () => void;
  onUpdated: () => void;
}) {
  const handleActionItemStatusChange = async (index: number, status: string) => {
    try {
      await updateMeetingActionItemStatus(meeting.projectId, meeting.id, index, status);
      onUpdated();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <button
          onClick={onBack}
          style={{
            padding: '6px 12px',
            background: COLORS.gray100,
            color: COLORS.textPrimary,
            border: 'none',
            borderRadius: 6,
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          ← Back
        </button>
        <h3 style={{ margin: 0, fontSize: 18, color: COLORS.textPrimary }}>{meeting.title}</h3>
        <span
          style={{
            padding: '2px 8px',
            borderRadius: 4,
            fontSize: 10,
            fontWeight: 700,
            color: COLORS.white,
            background: meeting.status === 'published' ? STATUS_COLORS.green.bg : COLORS.gray400,
            textTransform: 'uppercase',
          }}
        >
          {meeting.status}
        </span>
      </div>

      <div
        style={{
          padding: 16,
          background: COLORS.gray100,
          borderRadius: 8,
          marginBottom: 16,
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
        }}
      >
        <div>
          <div style={{ fontSize: 10, color: COLORS.textMuted, textTransform: 'uppercase' }}>Date</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.textPrimary, marginTop: 2 }}>
            {new Date(meeting.meetingDate).toLocaleDateString()}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: COLORS.textMuted, textTransform: 'uppercase' }}>Location</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.textPrimary, marginTop: 2 }}>
            {meeting.location ?? '—'}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: COLORS.textMuted, textTransform: 'uppercase' }}>Facilitator</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.textPrimary, marginTop: 2 }}>
            {meeting.facilitator ?? '—'}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10, color: COLORS.textMuted, textTransform: 'uppercase' }}>Attendees</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.textPrimary, marginTop: 2 }}>
            {(meeting.attendees ?? []).length}
          </div>
        </div>
      </div>

      {meeting.attendees && meeting.attendees.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <h4 style={{ fontSize: 13, color: COLORS.textSecondary, textTransform: 'uppercase', marginBottom: 8 }}>
            Attendees
          </h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {meeting.attendees.map((a, i) => (
              <span
                key={i}
                style={{
                  padding: '4px 10px',
                  background: COLORS.gray100,
                  borderRadius: 12,
                  fontSize: 12,
                  color: COLORS.textPrimary,
                }}
              >
                {a.name}
                {a.role && <span style={{ color: COLORS.textMuted, marginLeft: 6 }}>· {a.role}</span>}
              </span>
            ))}
          </div>
        </div>
      )}

      {meeting.agenda && meeting.agenda.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <h4 style={{ fontSize: 13, color: COLORS.textSecondary, textTransform: 'uppercase', marginBottom: 8 }}>
            Agenda
          </h4>
          <ol style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: COLORS.textPrimary, lineHeight: 1.7 }}>
            {meeting.agenda.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ol>
        </div>
      )}

      {meeting.minutes && (
        <div style={{ marginBottom: 16 }}>
          <h4 style={{ fontSize: 13, color: COLORS.textSecondary, textTransform: 'uppercase', marginBottom: 8 }}>
            Minutes
          </h4>
          <div
            style={{
              padding: 16,
              background: COLORS.white,
              border: `1px solid ${COLORS.gray200}`,
              borderRadius: 8,
              fontSize: 13,
              lineHeight: 1.7,
              color: COLORS.textPrimary,
              whiteSpace: 'pre-wrap',
              fontFamily: 'inherit',
            }}
          >
            {meeting.minutes}
          </div>
        </div>
      )}

      {meeting.actionItems && meeting.actionItems.length > 0 && (
        <div>
          <h4 style={{ fontSize: 13, color: COLORS.textSecondary, textTransform: 'uppercase', marginBottom: 8 }}>
            Action Items
          </h4>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: COLORS.gray100 }}>
                <th style={{ textAlign: 'left', padding: 8, fontWeight: 600, color: COLORS.textSecondary, fontSize: 11 }}>Description</th>
                <th style={{ textAlign: 'left', padding: 8, fontWeight: 600, color: COLORS.textSecondary, fontSize: 11 }}>Assignee</th>
                <th style={{ textAlign: 'left', padding: 8, fontWeight: 600, color: COLORS.textSecondary, fontSize: 11 }}>Due</th>
                <th style={{ textAlign: 'left', padding: 8, fontWeight: 600, color: COLORS.textSecondary, fontSize: 11 }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {meeting.actionItems.map((a, i) => (
                <tr key={i} style={{ borderTop: `1px solid ${COLORS.gray100}` }}>
                  <td style={{ padding: 8, color: COLORS.textPrimary }}>{a.description}</td>
                  <td style={{ padding: 8, color: COLORS.textSecondary }}>{a.assignee ?? '—'}</td>
                  <td style={{ padding: 8, color: COLORS.textSecondary }}>{a.dueDate ?? '—'}</td>
                  <td style={{ padding: 8 }}>
                    <select
                      value={a.status ?? 'open'}
                      onChange={(e) => handleActionItemStatusChange(i, e.target.value)}
                      style={{
                        padding: '4px 8px',
                        border: `1px solid ${COLORS.gray200}`,
                        borderRadius: 4,
                        fontSize: 12,
                        background: COLORS.white,
                      }}
                    >
                      <option value="open">Open</option>
                      <option value="in_progress">In Progress</option>
                      <option value="closed">Closed</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function NewMeetingForm({
  projectId,
  onCancel,
  onCreated,
}: {
  projectId: string;
  onCancel: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState('');
  const [meetingDate, setMeetingDate] = useState(new Date().toISOString().split('T')[0]);
  const [location, setLocation] = useState('');
  const [facilitator, setFacilitator] = useState('');
  const [attendees, setAttendees] = useState<Attendee[]>([{ name: '' }]);
  const [agenda, setAgenda] = useState<string[]>(['']);
  const [minutes, setMinutes] = useState('');
  const [actionItems, setActionItems] = useState<ActionItem[]>([
    { description: '', assignee: '', dueDate: '', status: 'open' },
  ]);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await createMeeting(projectId, {
        title,
        meetingDate: new Date(meetingDate),
        location: location || undefined,
        facilitator: facilitator || undefined,
        attendees: attendees.filter((a) => a.name.trim()),
        agenda: agenda.filter((a) => a.trim()),
        minutes: minutes || undefined,
        actionItems: actionItems.filter((a) => a.description.trim()),
        createdBy: 'pm',
        status: 'draft',
      });
      onCreated();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <button
          onClick={onCancel}
          style={{
            padding: '6px 12px',
            background: COLORS.gray100,
            color: COLORS.textPrimary,
            border: 'none',
            borderRadius: 6,
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          ← Cancel
        </button>
        <h3 style={{ margin: 0, fontSize: 18, color: COLORS.textPrimary }}>New Meeting</h3>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div>
          <label style={{ display: 'block', fontSize: 11, color: COLORS.textMuted, marginBottom: 4, textTransform: 'uppercase' }}>
            Title *
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{ width: '100%', padding: 8, border: `1px solid ${COLORS.gray200}`, borderRadius: 6, fontSize: 13 }}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 11, color: COLORS.textMuted, marginBottom: 4, textTransform: 'uppercase' }}>
            Date *
          </label>
          <input
            type="date"
            value={meetingDate}
            onChange={(e) => setMeetingDate(e.target.value)}
            style={{ width: '100%', padding: 8, border: `1px solid ${COLORS.gray200}`, borderRadius: 6, fontSize: 13 }}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 11, color: COLORS.textMuted, marginBottom: 4, textTransform: 'uppercase' }}>
            Location
          </label>
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            style={{ width: '100%', padding: 8, border: `1px solid ${COLORS.gray200}`, borderRadius: 6, fontSize: 13 }}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 11, color: COLORS.textMuted, marginBottom: 4, textTransform: 'uppercase' }}>
            Facilitator
          </label>
          <input
            value={facilitator}
            onChange={(e) => setFacilitator(e.target.value)}
            style={{ width: '100%', padding: 8, border: `1px solid ${COLORS.gray200}`, borderRadius: 6, fontSize: 13 }}
          />
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <h4 style={{ fontSize: 11, color: COLORS.textMuted, textTransform: 'uppercase', marginBottom: 8 }}>
          Attendees
        </h4>
        {attendees.map((a, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
            <input
              placeholder="Name"
              value={a.name}
              onChange={(e) => {
                const next = [...attendees];
                next[i] = { ...next[i], name: e.target.value };
                setAttendees(next);
              }}
              style={{ flex: 1, padding: 8, border: `1px solid ${COLORS.gray200}`, borderRadius: 6, fontSize: 13 }}
            />
            <input
              placeholder="Role (optional)"
              value={a.role ?? ''}
              onChange={(e) => {
                const next = [...attendees];
                next[i] = { ...next[i], role: e.target.value };
                setAttendees(next);
              }}
              style={{ flex: 1, padding: 8, border: `1px solid ${COLORS.gray200}`, borderRadius: 6, fontSize: 13 }}
            />
            <button
              onClick={() => setAttendees(attendees.filter((_, idx) => idx !== i))}
              style={{ padding: '4px 10px', background: COLORS.gray100, border: 'none', borderRadius: 4, cursor: 'pointer' }}
            >
              ×
            </button>
          </div>
        ))}
        <button
          onClick={() => setAttendees([...attendees, { name: '' }])}
          style={{ marginTop: 4, padding: '4px 12px', background: 'transparent', color: COLORS.orange, border: `1px solid ${COLORS.orange}`, borderRadius: 4, fontSize: 12, cursor: 'pointer' }}
        >
          + Add Attendee
        </button>
      </div>

      <div style={{ marginBottom: 16 }}>
        <h4 style={{ fontSize: 11, color: COLORS.textMuted, textTransform: 'uppercase', marginBottom: 8 }}>
          Agenda
        </h4>
        {agenda.map((item, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
            <input
              value={item}
              onChange={(e) => {
                const next = [...agenda];
                next[i] = e.target.value;
                setAgenda(next);
              }}
              style={{ flex: 1, padding: 8, border: `1px solid ${COLORS.gray200}`, borderRadius: 6, fontSize: 13 }}
            />
            <button
              onClick={() => setAgenda(agenda.filter((_, idx) => idx !== i))}
              style={{ padding: '4px 10px', background: COLORS.gray100, border: 'none', borderRadius: 4, cursor: 'pointer' }}
            >
              ×
            </button>
          </div>
        ))}
        <button
          onClick={() => setAgenda([...agenda, ''])}
          style={{ marginTop: 4, padding: '4px 12px', background: 'transparent', color: COLORS.orange, border: `1px solid ${COLORS.orange}`, borderRadius: 4, fontSize: 12, cursor: 'pointer' }}
        >
          + Add Agenda Item
        </button>
      </div>

      <div style={{ marginBottom: 16 }}>
        <h4 style={{ fontSize: 11, color: COLORS.textMuted, textTransform: 'uppercase', marginBottom: 8 }}>
          Minutes
        </h4>
        <textarea
          value={minutes}
          onChange={(e) => setMinutes(e.target.value)}
          rows={6}
          placeholder="Use markdown for formatting (## headings, - lists, **bold**)"
          style={{ width: '100%', padding: 8, border: `1px solid ${COLORS.gray200}`, borderRadius: 6, fontSize: 13, fontFamily: 'inherit' }}
        />
      </div>

      <div style={{ marginBottom: 16 }}>
        <h4 style={{ fontSize: 11, color: COLORS.textMuted, textTransform: 'uppercase', marginBottom: 8 }}>
          Action Items
        </h4>
        {actionItems.map((a, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '3fr 1fr 1fr auto', gap: 6, marginBottom: 6 }}>
            <input
              placeholder="Description"
              value={a.description}
              onChange={(e) => {
                const next = [...actionItems];
                next[i] = { ...next[i], description: e.target.value };
                setActionItems(next);
              }}
              style={{ padding: 8, border: `1px solid ${COLORS.gray200}`, borderRadius: 6, fontSize: 13 }}
            />
            <input
              placeholder="Assignee"
              value={a.assignee ?? ''}
              onChange={(e) => {
                const next = [...actionItems];
                next[i] = { ...next[i], assignee: e.target.value };
                setActionItems(next);
              }}
              style={{ padding: 8, border: `1px solid ${COLORS.gray200}`, borderRadius: 6, fontSize: 13 }}
            />
            <input
              type="date"
              value={a.dueDate ?? ''}
              onChange={(e) => {
                const next = [...actionItems];
                next[i] = { ...next[i], dueDate: e.target.value };
                setActionItems(next);
              }}
              style={{ padding: 8, border: `1px solid ${COLORS.gray200}`, borderRadius: 6, fontSize: 13 }}
            />
            <button
              onClick={() => setActionItems(actionItems.filter((_, idx) => idx !== i))}
              style={{ padding: '4px 10px', background: COLORS.gray100, border: 'none', borderRadius: 4, cursor: 'pointer' }}
            >
              ×
            </button>
          </div>
        ))}
        <button
          onClick={() => setActionItems([...actionItems, { description: '', assignee: '', dueDate: '', status: 'open' }])}
          style={{ marginTop: 4, padding: '4px 12px', background: 'transparent', color: COLORS.orange, border: `1px solid ${COLORS.orange}`, borderRadius: 4, fontSize: 12, cursor: 'pointer' }}
        >
          + Add Action Item
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 16, paddingTop: 16, borderTop: `1px solid ${COLORS.gray100}` }}>
        <button
          onClick={handleSave}
          disabled={saving || !title.trim()}
          style={{
            padding: '8px 20px',
            background: COLORS.orange,
            color: COLORS.white,
            border: 'none',
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 600,
            cursor: saving ? 'wait' : 'pointer',
            opacity: !title.trim() ? 0.5 : 1,
          }}
        >
          {saving ? 'Saving...' : 'Save as Draft'}
        </button>
        <button
          onClick={onCancel}
          style={{
            padding: '8px 20px',
            background: COLORS.gray100,
            color: COLORS.textPrimary,
            border: 'none',
            borderRadius: 6,
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export function MeetingsView({ projectId }: { projectId: string }) {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [selected, setSelected] = useState<Meeting | null>(null);
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const data = await getMeetings(projectId);
      setMeetings(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [projectId]);

  if (creating) {
    return (
      <NewMeetingForm
        projectId={projectId}
        onCancel={() => setCreating(false)}
        onCreated={() => {
          setCreating(false);
          load();
        }}
      />
    );
  }

  if (selected) {
    return (
      <MeetingDetail
        meeting={selected}
        onBack={() => setSelected(null)}
        onUpdated={() => {
          load();
          // Re-fetch the selected meeting
          getMeeting(projectId, selected.id).then((m) => setSelected(m));
        }}
      />
    );
  }

  if (loading) {
    return <div style={{ padding: 32, textAlign: 'center', color: COLORS.textMuted }}>Loading meetings...</div>;
  }

  return (
    <MeetingList
      meetings={meetings}
      onSelect={(m) => setSelected(m)}
      onCreateNew={() => setCreating(true)}
    />
  );
}
