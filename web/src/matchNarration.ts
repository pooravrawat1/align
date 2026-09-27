export type NarrationStatus = 'idle' | 'loading' | 'speaking' | 'blocked' | 'unavailable';
export type NarrationMatch = { id: string; reason: string };
type Candidate = { id: string; key: string };
type Playback = Candidate & { controller: AbortController; buffer?: AudioBuffer };

/** Owns a serial queue so new matches never talk over each other. */
export class MatchNarrator {
  private context: AudioContext | null = null;
  private source: AudioBufferSourceNode | null = null;
  private current: Playback | null = null;
  private candidates: Candidate[] = [];
  private spoken = new Set<string>();
  private scope = '';
  private sessionId = '';
  private enabled = false;
  private failed = false;
  private onStatus: (status: NarrationStatus) => void;
  private createContext: () => AudioContext;
  private fetchImpl: typeof fetch;

  constructor(onStatus: (status: NarrationStatus) => void, createContext = () => new AudioContext(), fetchImpl = globalThis.fetch.bind(globalThis)) {
    this.onStatus = onStatus;
    this.createContext = createContext;
    this.fetchImpl = fetchImpl;
  }

  // Call synchronously from Enter preview / the audio button to unlock browser audio.
  unlock() {
    try {
      this.context ??= this.createContext();
      const context = this.context;
      void context.resume().then(() => {
        if (this.context === context && this.current?.buffer) this.play(this.current);
      }).catch(() => { if (this.context === context) this.onStatus('blocked'); });
    } catch { this.onStatus('unavailable'); }
  }

  update(sessionId: string, scope: string, matches: NarrationMatch[], enabled: boolean) {
    if (this.scope !== scope || this.sessionId !== sessionId) {
      this.cancel();
      this.spoken.clear();
      this.failed = false;
    }
    this.scope = scope;
    this.sessionId = sessionId;
    this.enabled = enabled;
    this.candidates = matches.filter(match => match.reason.trim()).map(match => ({
      id: match.id, key: JSON.stringify([match.id, match.reason]),
    }));
    const keys = new Set(this.candidates.map(candidate => candidate.key));
    for (const key of this.spoken) if (!keys.has(key)) this.spoken.delete(key);
    if (!enabled || (this.current && !keys.has(this.current.key))) this.cancel();
    if (enabled) void this.next();
    else this.onStatus('idle');
  }

  retry() {
    this.failed = false;
    this.unlock();
    void this.next();
  }

  private cancel() {
    const current = this.current;
    this.current = null;
    current?.controller.abort();
    if (this.source) {
      this.source.onended = null;
      this.source.stop();
      this.source.disconnect();
      this.source = null;
    }
  }

  private async next() {
    if (!this.enabled || this.current || this.failed || !this.sessionId) return;
    const candidate = this.candidates.find(item => !this.spoken.has(item.key));
    if (!candidate) { this.onStatus('idle'); return; }
    const current: Playback = { ...candidate, controller: new AbortController() };
    this.current = current;
    this.onStatus('loading');
    const timer = setTimeout(() => current.controller.abort(), 35000);
    try {
      const response = await this.fetchImpl('/api/narration', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-session-id': this.sessionId },
        body: JSON.stringify({ participantId: candidate.id }),
        signal: current.controller.signal,
      });
      if (!response.ok) throw new Error('Narration unavailable');
      const bytes = await response.arrayBuffer();
      if (this.current !== current) return;
      this.context ??= this.createContext();
      current.buffer = await this.context.decodeAudioData(bytes);
      if (this.current !== current) return;
      this.play(current);
    } catch {
      if (this.current !== current) return;
      this.cancel();
      this.failed = true;
      this.onStatus('unavailable');
    } finally { clearTimeout(timer); }
  }

  private play(current: Playback) {
    if (this.current !== current || !current.buffer || this.source) return;
    if (this.context?.state !== 'running') { this.onStatus('blocked'); return; }
    const source = this.context.createBufferSource();
    source.buffer = current.buffer;
    source.connect(this.context.destination);
    source.onended = () => {
      source.disconnect();
      if (this.current !== current) return;
      this.source = null;
      this.current = null;
      void this.next();
    };
    this.source = source;
    source.start();
    this.spoken.add(current.key);
    this.onStatus('speaking');
  }

  dispose() {
    this.cancel();
    this.enabled = false;
    this.spoken.clear();
    const context = this.context;
    this.context = null;
    if (context && context.state !== 'closed') void context.close().catch(() => {});
  }
}
