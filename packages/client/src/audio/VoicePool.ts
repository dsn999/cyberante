/** Owns transient nodes, including modulators and future scheduled sources. */
export class Voice {
  private nodes = new Set<AudioNode>();
  private sources = new Set<AudioScheduledSourceNode>();
  private ended = 0;
  private released = false;
  constructor(private readonly release: () => void) {}

  public node<T extends AudioNode>(node: T): T { this.nodes.add(node); return node; }
  public source<T extends AudioScheduledSourceNode>(source: T): T {
    this.node(source);
    this.sources.add(source);
    source.onended = () => {
      this.ended++;
      if (this.ended === this.sources.size) this.disconnect();
    };
    return source;
  }
  public get sourceCount(): number { return this.sources.size; }

  public cancel(): void {
    if (this.released) return;
    for (const source of this.sources) {
      source.onended = null;
      try { source.stop(); } catch { /* Already ended or never started. */ }
    }
    this.disconnect();
  }
  private disconnect(): void {
    if (this.released) return;
    this.released = true;
    for (const source of this.sources) source.onended = null;
    for (const node of this.nodes) node.disconnect();
    this.nodes.clear();
    this.sources.clear();
    this.release();
  }
}

export class VoicePool {
  private voices = new Set<Voice>();
  constructor(private readonly limit: number) {}
  public get activeSources(): number {
    let count = 0;
    for (const voice of this.voices) count += voice.sourceCount;
    return count;
  }
  public create(sourceCount: number): Voice {
    if (sourceCount > this.limit) throw new RangeError('Voice exceeds polyphony limit');
    while (this.activeSources + sourceCount > this.limit) this.voices.values().next().value?.cancel();
    const voice = new Voice(() => this.voices.delete(voice));
    this.voices.add(voice);
    return voice;
  }
  public clear(): void { for (const voice of this.voices) voice.cancel(); }
}
