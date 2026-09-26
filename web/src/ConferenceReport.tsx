import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Check, Copy, Mail, RefreshCw, X } from 'lucide-react';
import { Avatar, Button, Chip, PanelHeader, TextAction } from './ui';
import { draftStorageKey, followUpContext, followUpEvidenceContext, preparedFollowUp, readDraft } from './followUpModel';
import type { FollowUpDraft, FollowUpPerson, FollowUpResult } from './followUpModel';
import './EventRecap.css';

type Props = {
  people: FollowUpPerson[];
  eventId: string;
  eventName: string;
  ownerKey: string;
  senderName: string;
  demo?: boolean;
  pendingCount?: number;
  notify: (message: string) => void;
  onSave: (id: string, patch: { notes?: string; contacted?: boolean }) => Promise<void>;
  onGenerate: (id: string, notes: string, style: 'standard' | 'short', signal: AbortSignal) => Promise<FollowUpResult>;
  onProfile?: (id: string) => void;
};

function FollowUpEditor({ person, ...props }: Omit<Props, 'people'> & { person: FollowUpPerson }) {
  const context = followUpContext(person, props.eventName, props.senderName);
  const evidenceContext = followUpEvidenceContext(person, props.eventName, props.senderName);
  const key = draftStorageKey(props.ownerKey, props.eventId, person.id);
  const [notes, setNotes] = useState(person.notes);
  const [draft, setDraft] = useState<FollowUpDraft>(() => {
    let saved: FollowUpDraft | null = null;
    try { saved = readDraft(localStorage, key); } catch { /* Browser storage may be disabled. */ }
    return saved?.evidenceContext === evidenceContext ? saved : { message: preparedFollowUp(person, props.eventName), context, evidenceContext, source: 'prepared' };
  });
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [storageError, setStorageError] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const requestRevision = useRef(0);
  const inputContext = followUpContext({ ...person, notes }, props.eventName, props.senderName);
  const changedContext = draft.context !== inputContext;
  const noteDirty = notes !== person.notes;
  const messageRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => () => { controller.current?.abort(); requestRevision.current += 1; }, []);
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(draft)); setStorageError(false); }
    catch { setStorageError(true); }
  }, [draft, key]);

  const saveNote = async () => {
    setSaving(true); setError('');
    try { await props.onSave(person.id, { notes }); props.notify('Meeting note saved.'); }
    catch { setError('Your note could not be saved. Try again.'); }
    finally { setSaving(false); }
  };
  const generate = async (style: 'standard' | 'short') => {
    controller.current?.abort();
    const abort = new AbortController(); controller.current = abort;
    const revision = ++requestRevision.current;
    setGenerating(true); setError('');
    try {
      if (noteDirty) await props.onSave(person.id, { notes });
      const result = await props.onGenerate(person.id, notes, style, abort.signal);
      if (abort.signal.aborted || revision !== requestRevision.current) return;
      setDraft({ message: result.message, summary: result.summary, nextStep: result.nextStep, context: inputContext, evidenceContext, source: 'gemini' });
      messageRef.current?.focus();
    } catch (failure) {
      if (!abort.signal.aborted && revision === requestRevision.current) setError(failure instanceof Error ? failure.message : 'Could not generate a message. Your draft is still here.');
    } finally { if (revision === requestRevision.current) setGenerating(false); }
  };
  const editNotes = (value: string) => {
    controller.current?.abort(); requestRevision.current += 1; setGenerating(false); setNotes(value);
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(draft.message); props.notify('Message copied. Mark contacted after you send it.'); }
    catch { messageRef.current?.focus(); messageRef.current?.select(); setError('Copy is unavailable here. Select the message and copy it manually.'); }
  };
  const email = person.contacts.find(contact => contact.kind === 'email');

  return <div className="recap-editor">
    <div className="recap-note-editor">
      <label htmlFor={`meeting-${person.id}`}>Your meeting note</label>
      <p>What did you discuss? What would you like to do next?</p>
      <textarea id={`meeting-${person.id}`} rows={3} maxLength={2000} value={notes} onChange={event => editNotes(event.target.value)} placeholder="A topic, an idea, or something you offered to share…" />
      <TextAction onClick={() => void saveNote()} disabled={!noteDirty || saving || generating}>{saving ? 'Saving…' : 'Save note'}</TextAction>
    </div>
    <div className="recap-message-editor">
      <div className="recap-editor-heading"><label htmlFor={`message-${person.id}`}>Your follow-up message</label><span>{draft.source === 'gemini' ? 'Gemini draft' : draft.source === 'edited' ? 'Edited by you' : 'Prepared starter'}</span></div>
      <p>Gemini uses your note and shared profile topics. Check its suggestions against your note before sending.</p>
      {draft.source === 'gemini' && !changedContext && <div className="recap-generated-context"><p><strong>AI-suggested context</strong>{draft.summary}</p><p><strong>Suggested next step</strong>{draft.nextStep}</p></div>}
      <textarea ref={messageRef} id={`message-${person.id}`} rows={5} maxLength={3000} value={draft.message} disabled={generating} onChange={event => setDraft({ ...draft, source: 'edited', message: event.target.value })} />
      {changedContext && <p className="recap-context-change">Your context changed. Your draft is kept; generate again to use the updated details.</p>}
      <div className="recap-editor-actions"><Button busy={generating} disabled={saving} onClick={() => void generate('standard')}>{generating ? 'Writing your follow-up…' : draft.source === 'prepared' ? 'Generate with Gemini' : 'Regenerate'}<RefreshCw size={15} /></Button><Button variant="secondary" disabled={!draft.message.trim() || generating} onClick={() => void copy()}>Copy message<Copy size={15} /></Button><TextAction disabled={generating || saving} onClick={() => void generate('short')}>Generate a short version</TextAction></div>
      {email && <TextAction href={`${email.href}?subject=${encodeURIComponent(`Following up from ${props.eventName}`)}&body=${encodeURIComponent(draft.message)}`} icon={<Mail size={15} />}>Open email draft</TextAction>}
      {error && <p className="recap-error" role="alert">{error}</p>}
      {storageError && <p className="recap-error" role="status">Browser storage is unavailable. Copy your draft before leaving.</p>}
      <p className="recap-editor-footnote">Nothing is sent automatically. Copying or opening email does not mark this person contacted.</p>
    </div>
  </div>;
}

export function ConferenceReport({ people, ...props }: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'needed' | 'contacted'>('all');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState('');
  const connected = people.filter(person => person.relationship === 'connected').length;
  const saved = people.filter(person => person.savedPrivately ?? person.relationship === 'saved').length;
  const needsFollowUp = (person: FollowUpPerson) => person.needsFollowUp ?? !person.contacted;
  const remaining = people.filter(needsFollowUp).length;
  const common = [...new Set(people.flatMap(person => person.sharedInterests))].slice(0, 5);
  const visible = people.filter(person => filter === 'all' || (filter === 'contacted' ? person.contacted : needsFollowUp(person)));
  const mark = async (person: FollowUpPerson) => {
    setSavingId(person.id); setSaveError('');
    try { await props.onSave(person.id, { contacted: !person.contacted }); props.notify(person.contacted ? 'Moved back to follow up.' : 'Marked contacted. Your connection stays in the report.'); }
    catch { setSaveError('Could not update follow-up status. Try again.'); }
    finally { setSavingId(null); }
  };

  return <section className="product-panel recap-report" aria-labelledby="recap-people-title">
    <PanelHeader headingId="recap-people-title" title="Your event recap" description={`${connected} connected · ${saved} saved privately${props.pendingCount ? ` · ${props.pendingCount} pending` : ''}`} action={!props.demo ? <TextAction href="#/recap-demo">Try a completed-conference demo<ArrowUpRight size={15} /></TextAction> : undefined} />
    <div className="recap-introduction"><h3>{people.length ? 'Keep the conversation going.' : 'Your next connection starts here.'}</h3><p>{people.length ? `${remaining ? `${remaining} ${remaining === 1 ? 'person to follow up with' : 'people to follow up with'}.` : 'You’re caught up.'} Revisit your common ground, add what you remember, and make the next message personal.` : 'Connect with someone or save their profile at this event. Your people and next steps will appear here.'}</p>{common.length > 0 && <div className="recap-topics">{common.map(topic => <Chip key={topic}>{topic}</Chip>)}</div>}</div>
    {people.length > 0 && <div className="recap-list-toolbar"><h3>Your people</h3><div className="workspace-tabs" role="group" aria-label="Filter follow-ups">{(['all', 'needed', 'contacted'] as const).map(value => <button key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{value === 'all' ? 'Everyone' : value === 'needed' ? 'To follow up' : 'Contacted'}</button>)}</div></div>}
    {saveError && <p className="recap-error" role="alert">{saveError}</p>}
    <div className="recap-report-list">{visible.map(person => <article className="recap-report-person" key={person.id}>
      <div className="recap-person-main"><div className="recap-person-identity">{props.onProfile ? <button className="recap-profile-link" aria-label={`View ${person.profile.name}'s profile`} onClick={() => props.onProfile?.(person.id)}><Avatar profile={person.profile} /><span><strong>{person.profile.name}</strong><span>{person.withdrawn ? 'Shared profile is private' : person.profile.role}</span></span></button> : <div className="recap-profile-link"><Avatar profile={person.profile} /><span><strong>{person.profile.name}</strong><span>{person.profile.role}</span></span></div>}<span className="recap-relationship">{person.relationship === 'connected' ? 'Connected' : 'Saved privately'}{person.contacted && <span><Check size={13} />Contacted</span>}</span></div>
        <div className="recap-person-context">{person.withdrawn ? <p>Shared details are no longer available. Your private note is kept.</p> : <p><strong>Common ground</strong>{person.sharedInterests.length ? person.sharedInterests.join(' · ') : 'No shared profile topics yet.'}</p>}{person.notes.trim() && <p><strong>Your meeting note</strong>{person.notes}</p>}{!person.notes.trim() && <p className="recap-no-note">No meeting note yet. Add one to make your follow-up more personal.</p>}{person.example && person.notes === person.example.notes && <p><strong>Suggested next step</strong>{person.example.nextStep}</p>}</div>
        <div className="recap-person-actions">{!person.withdrawn && <Button variant={selected === person.id ? 'secondary' : 'primary'} aria-expanded={selected === person.id} aria-controls={`followup-${person.id}`} onClick={() => setSelected(selected === person.id ? null : person.id)}>{selected === person.id ? 'Close draft' : 'Draft follow-up'}{selected === person.id && <X size={15} />}</Button>}<TextAction disabled={savingId !== null} onClick={() => void mark(person)}>{savingId === person.id ? 'Saving…' : person.contacted ? 'Mark to follow up' : 'Mark contacted'}</TextAction></div>
      </div>
      {selected === person.id && !person.withdrawn && <div id={`followup-${person.id}`}><FollowUpEditor key={`${props.ownerKey}:${props.eventId}:${person.id}:${followUpEvidenceContext(person, props.eventName, props.senderName)}`} person={person} {...props} /></div>}
    </article>)}</div>
    {people.length > 0 && visible.length === 0 && <p className="recap-filter-empty">{filter === 'contacted' ? 'No one marked contacted yet.' : 'You’re caught up. Your people are still in Everyone.'}</p>}
  </section>;
}
