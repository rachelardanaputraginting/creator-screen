/**
 * Audio Enhancer & Anti-Noise processing module for Creator Screen.
 *
 * Implements:
 * 1. WebRTC audio constraints (hardware/browser noiseSuppression, echoCancellation, autoGainControl)
 * 2. Web Audio API processing pipeline:
 *    - High-pass filter (cuts low rumble < 85Hz: table vibrations, AC hum, laptop fans)
 *    - Vocal presence filter (peaking at 3kHz: speech clarity & articulation)
 *    - Dynamics compressor (smooths vocal dynamics & prevents sudden audio spikes/clipping)
 *    - Real-time crossfade bypass when toggled without recreating tracks.
 */

export interface AudioProcessingOptions {
    deviceId?: string;
    noiseSuppression: boolean;
    echoCancellation: boolean;
    autoGainControl: boolean;
    voiceEnhancer: boolean;
}

export class AudioEnhancerPipeline {
    private audioCtx: AudioContext | null = null;
    private rawStream: MediaStream;
    private processedStream: MediaStream;
    private sourceNode: MediaStreamAudioSourceNode | null = null;
    private destNode: MediaStreamAudioDestinationNode | null = null;
    private hpFilter: BiquadFilterNode | null = null;
    private clarityFilter: BiquadFilterNode | null = null;
    private compressor: DynamicsCompressorNode | null = null;
    private enhancedGain: GainNode | null = null;
    private rawGain: GainNode | null = null;
    private options: AudioProcessingOptions;
    private disposed = false;

    constructor(
        rawStream: MediaStream,
        processedStream: MediaStream,
        audioCtx: AudioContext | null,
        nodes: {
            sourceNode?: MediaStreamAudioSourceNode;
            destNode?: MediaStreamAudioDestinationNode;
            hpFilter?: BiquadFilterNode;
            clarityFilter?: BiquadFilterNode;
            compressor?: DynamicsCompressorNode;
            enhancedGain?: GainNode;
            rawGain?: GainNode;
        },
        options: AudioProcessingOptions,
    ) {
        this.rawStream = rawStream;
        this.processedStream = processedStream;
        this.audioCtx = audioCtx;
        this.sourceNode = nodes.sourceNode ?? null;
        this.destNode = nodes.destNode ?? null;
        this.hpFilter = nodes.hpFilter ?? null;
        this.clarityFilter = nodes.clarityFilter ?? null;
        this.compressor = nodes.compressor ?? null;
        this.enhancedGain = nodes.enhancedGain ?? null;
        this.rawGain = nodes.rawGain ?? null;
        this.options = { ...options };
    }

    public get stream(): MediaStream {
        return this.processedStream;
    }

    public get raw(): MediaStream {
        return this.rawStream;
    }

    public get activeDeviceLabel(): string {
        return this.rawStream.getAudioTracks()[0]?.label || "Microphone";
    }

    public setVoiceEnhancer(enabled: boolean): void {
        this.options.voiceEnhancer = enabled;
        if (!this.audioCtx || !this.enhancedGain || !this.rawGain) return;
        try {
            const now = this.audioCtx.currentTime;
            this.enhancedGain.gain.setTargetAtTime(enabled ? 1.0 : 0.0, now, 0.02);
            this.rawGain.gain.setTargetAtTime(enabled ? 0.0 : 1.0, now, 0.02);
        } catch {
            /* noop */
        }
    }

    public async updateConstraints(
        updates: Partial<Pick<AudioProcessingOptions, "noiseSuppression" | "echoCancellation" | "autoGainControl">>,
    ): Promise<void> {
        this.options = { ...this.options, ...updates };
        const track = this.rawStream.getAudioTracks()[0];
        if (!track || track.readyState !== "live") return;
        try {
            await track.applyConstraints({
                noiseSuppression: this.options.noiseSuppression,
                echoCancellation: this.options.echoCancellation,
                autoGainControl: this.options.autoGainControl,
            });
        } catch {
            /* constraint application failed; silent fallback */
        }
    }

    public stop(): void {
        if (this.disposed) return;
        this.disposed = true;

        try {
            this.rawStream.getTracks().forEach((t) => {
                try {
                    t.stop();
                } catch {
                    /* noop */
                }
            });
        } catch {
            /* noop */
        }

        try {
            this.processedStream.getTracks().forEach((t) => {
                try {
                    t.stop();
                } catch {
                    /* noop */
                }
            });
        } catch {
            /* noop */
        }

        if (this.audioCtx && this.audioCtx.state !== "closed") {
            try {
                this.sourceNode?.disconnect();
                this.hpFilter?.disconnect();
                this.clarityFilter?.disconnect();
                this.compressor?.disconnect();
                this.enhancedGain?.disconnect();
                this.rawGain?.disconnect();
                void this.audioCtx.close().catch(() => {});
            } catch {
                /* noop */
            }
        }
    }
}

export async function createEnhancedMicrophoneStream(
    options: AudioProcessingOptions,
): Promise<AudioEnhancerPipeline> {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        throw new Error("Microphone is not supported in this browser.");
    }

    const audioConstraints: MediaTrackConstraints = {
        noiseSuppression: options.noiseSuppression,
        echoCancellation: options.echoCancellation,
        autoGainControl: options.autoGainControl,
        channelCount: 1,
    };

    if (options.deviceId && options.deviceId !== "default") {
        audioConstraints.deviceId = { exact: options.deviceId };
    }

    const rawStream = await navigator.mediaDevices.getUserMedia({
        video: false,
        audio: audioConstraints,
    });

    const AudioContextClass =
        typeof window !== "undefined"
            ? window.AudioContext ||
              (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
            : null;

    if (!AudioContextClass) {
        // Fallback: Web Audio API not available, return raw stream directly
        return new AudioEnhancerPipeline(rawStream, rawStream, null, {}, options);
    }

    try {
        const audioCtx = new AudioContextClass();
        if (audioCtx.state === "suspended") {
            await audioCtx.resume().catch(() => {});
        }

        const sourceNode = audioCtx.createMediaStreamSource(rawStream);
        const destNode = audioCtx.createMediaStreamDestination();

        // 1. High-pass filter (85 Hz, Q 0.707) — removes low-frequency hum & desk rumble
        const hpFilter = audioCtx.createBiquadFilter();
        hpFilter.type = "highpass";
        hpFilter.frequency.value = 85;
        hpFilter.Q.value = 0.707;

        // 2. Presence/Clarity filter (3000 Hz, +2.5 dB, Q 1.0) — boosts vocal articulation
        const clarityFilter = audioCtx.createBiquadFilter();
        clarityFilter.type = "peaking";
        clarityFilter.frequency.value = 3000;
        clarityFilter.gain.value = 2.5;
        clarityFilter.Q.value = 1.0;

        // 3. Dynamics Compressor — tames volume peaks, lifts soft speech
        const compressor = audioCtx.createDynamicsCompressor();
        compressor.threshold.value = -24;
        compressor.knee.value = 12;
        compressor.ratio.value = 4;
        compressor.attack.value = 0.003;
        compressor.release.value = 0.25;

        // 4. Enhanced Gain Node (Path A)
        const enhancedGain = audioCtx.createGain();
        enhancedGain.gain.value = options.voiceEnhancer ? 1.0 : 0.0;

        // 5. Raw Bypass Gain Node (Path B)
        const rawGain = audioCtx.createGain();
        rawGain.gain.value = options.voiceEnhancer ? 0.0 : 1.0;

        // Connect enhanced chain: source -> hpFilter -> clarityFilter -> compressor -> enhancedGain -> destNode
        sourceNode.connect(hpFilter);
        hpFilter.connect(clarityFilter);
        clarityFilter.connect(compressor);
        compressor.connect(enhancedGain);
        enhancedGain.connect(destNode);

        // Connect raw bypass: source -> rawGain -> destNode
        sourceNode.connect(rawGain);
        rawGain.connect(destNode);

        const processedStream = destNode.stream;

        return new AudioEnhancerPipeline(
            rawStream,
            processedStream,
            audioCtx,
            {
                sourceNode,
                destNode,
                hpFilter,
                clarityFilter,
                compressor,
                enhancedGain,
                rawGain,
            },
            options,
        );
    } catch {
        // Fallback on any Web Audio initialization error
        return new AudioEnhancerPipeline(rawStream, rawStream, null, {}, options);
    }
}
