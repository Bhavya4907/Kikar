import { supabase } from "./supabase"

export interface VoicePeerState {
  /** The account's user id (unique among the peers you can see). */
  userId: string
  /** Per-session id: the same account in two tabs/devices gets two different peer ids. */
  peerId?: string
  username: string
  avatarUrl?: string
  isMuted: boolean
  isDeafened: boolean
  isSpeaking: boolean
  connectedState?: RTCPeerConnectionState
}

// ── ICE servers ────────────────────────────────────────────────────────────
// STUN alone fails on many mobile carriers / strict NATs (CGNAT). Configure a TURN relay:
//   NEXT_PUBLIC_TURN_URLS=turn:your.host:3478,turns:your.host:5349?transport=tcp
//   NEXT_PUBLIC_TURN_USERNAME=...
//   NEXT_PUBLIC_TURN_CREDENTIAL=...
// (NEXT_PUBLIC_* values are visible in the browser; for production prefer short-lived credentials.)
let warnedNoTurn = false

function buildRtcConfig(): RTCConfiguration {
  const iceServers: RTCIceServer[] = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
  ]

  const turnUrls = (process.env.NEXT_PUBLIC_TURN_URLS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
  const username = process.env.NEXT_PUBLIC_TURN_USERNAME
  const credential = process.env.NEXT_PUBLIC_TURN_CREDENTIAL

  if (turnUrls.length > 0 && username && credential) {
    iceServers.push({ urls: turnUrls, username, credential })
  } else if (!warnedNoTurn) {
    warnedNoTurn = true
    console.warn(
      "[voice] No TURN server configured (NEXT_PUBLIC_TURN_URLS / _USERNAME / _CREDENTIAL). " +
        "Voice will fail for users behind strict NATs or on some mobile networks."
    )
  }
  return { iceServers }
}

// ── Tuning ─────────────────────────────────────────────────────────────────
const VAD_INTERVAL_MS = 100
const VAD_ON_LEVEL = 0.035 // RMS above this = speaking
const VAD_OFF_LEVEL = 0.02 // RMS above this keeps "speaking" alive (hysteresis)
const VAD_HOLD_MS = 400 // stay "speaking" this long after the last loud frame
const DISCONNECT_GRACE_MS = 5000
const MAX_RECOVERY_ATTEMPTS = 5

function newId(): string {
  try {
    const c = (globalThis as any).crypto
    if (c?.randomUUID) return c.randomUUID()
  } catch {
    // ignore
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

interface PeerLink {
  pc: RTCPeerConnection
  /** Shared id for this specific connection attempt, chosen by the initiator. */
  connId: string | null
  initiator: boolean
  createdAt: number
}

export class WebRTCVoiceManager {
  private channelId: string
  private myUserId: string
  private myPeerId: string
  private myUsername: string
  private myAvatarUrl: string
  private onPeersChanged: (peers: VoicePeerState[]) => void
  private onError?: (err: string) => void
  private rtcConfig: RTCConfiguration

  private sigChannel: any = null
  private subscribed = false
  private joined = false
  private localStream: MediaStream | null = null

  private peerLinks: Map<string, PeerLink> = new Map()
  private pendingCandidates: Map<string, { connId: string; candidate: RTCIceCandidateInit }[]> = new Map()
  private audioElements: Map<string, HTMLAudioElement> = new Map()
  private peerVolumes: Map<string, number> = new Map() // keyed by userId, survives reconnects
  private peersMeta: Map<string, VoicePeerState> = new Map() // keyed by peerId

  private disconnectTimers: Map<string, any> = new Map()
  private recreateTimers: Map<string, any> = new Map()
  private recoverAttempts: Map<string, number> = new Map()
  private gaveUp: Set<string> = new Set()

  private isMuted = false
  private isDeafened = false
  private isSpeaking = false

  private audioCtx: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private vadInterval: any = null
  private lastLoudAt = 0
  private unlockHandler: (() => void) | null = null

  constructor(opts: {
    channelId: string
    userId: string
    username: string
    avatarUrl?: string
    onPeersChanged: (peers: VoicePeerState[]) => void
    onError?: (err: string) => void
  }) {
    this.channelId = opts.channelId
    this.myUserId = opts.userId
    // One id per joined session, so two tabs / devices of the same account never collide.
    this.myPeerId = `${opts.userId}:${newId().slice(0, 8)}`
    this.myUsername = opts.username
    this.myAvatarUrl = opts.avatarUrl || ""
    this.onPeersChanged = opts.onPeersChanged
    this.onError = opts.onError
    this.rtcConfig = buildRtcConfig()
  }

  // ───────────────────────────── join / leave ─────────────────────────────

  public async join(): Promise<boolean> {
    if (this.joined) return true
    this.joined = true

    // 1. Microphone (falls back to listen-only)
    try {
      if (typeof navigator !== "undefined" && navigator.mediaDevices?.getUserMedia) {
        this.localStream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
          video: false,
        })
        this.setupVoiceActivityDetection(this.localStream)
      } else {
        throw new Error("Microphone API unavailable")
      }
    } catch (err: any) {
      console.warn("Microphone access unavailable, joining in listen-only mode:", err?.message || err)
      this.isMuted = true
      this.onError?.("Microphone permission denied or unavailable — joined in listen-only mode.")
    }

    // Browsers may block audio until a user gesture; unlock on any click/tap.
    if (typeof document !== "undefined") {
      this.unlockHandler = () => this.resumeAudio()
      document.addEventListener("click", this.unlockHandler)
      document.addEventListener("touchend", this.unlockHandler)
    }

    // 2. Register self
    this.peersMeta.set(this.myPeerId, {
      userId: this.myUserId,
      peerId: this.myPeerId,
      username: this.myUsername,
      avatarUrl: this.myAvatarUrl,
      isMuted: this.isMuted,
      isDeafened: this.isDeafened,
      isSpeaking: false,
      connectedState: "connected",
    })
    this.emitPeers()

    // 3. Signaling over Supabase Realtime (presence key = per-session peer id)
    this.sigChannel = supabase.channel(`kikar-webrtc-voice-${this.channelId}`, {
      config: {
        presence: { key: this.myPeerId },
        broadcast: { self: false },
      },
    })

    this.sigChannel
      .on("presence", { event: "sync" }, () => this.handlePresenceSync())
      .on("presence", { event: "leave" }, ({ key }: { key: string }) => {
        if (!key || key === this.myPeerId) return
        // Re-tracking (mute/deafen updates) also emits a "leave" for the old state while the
        // peer is still here. Only treat it as a real departure if no state remains.
        const current = this.sigChannel?.presenceState?.()?.[key]
        if (Array.isArray(current) && current.length > 0) return
        this.removePeer(key)
        this.emitPeers()
      })
      .on("broadcast", { event: "webrtc-offer" }, async ({ payload }: any) => {
        if (!payload || payload.targetId !== this.myPeerId) return
        await this.handleRemoteOffer(payload.senderId, payload.connId, payload.sdp)
      })
      .on("broadcast", { event: "webrtc-answer" }, async ({ payload }: any) => {
        if (!payload || payload.targetId !== this.myPeerId) return
        await this.handleRemoteAnswer(payload.senderId, payload.connId, payload.sdp)
      })
      .on("broadcast", { event: "webrtc-ice" }, async ({ payload }: any) => {
        if (!payload || payload.targetId !== this.myPeerId) return
        await this.handleRemoteIce(payload.senderId, payload.connId, payload.candidate)
      })
      .on("broadcast", { event: "webrtc-reconnect" }, ({ payload }: any) => {
        if (!payload || payload.targetId !== this.myPeerId) return
        this.handleReconnectRequest(payload.senderId)
      })
      .on("broadcast", { event: "voice-state" }, ({ payload }: any) => {
        if (!payload || !payload.peerId || payload.peerId === this.myPeerId) return
        const existing = this.peersMeta.get(payload.peerId)
        if (existing) {
          this.peersMeta.set(payload.peerId, {
            ...existing,
            isMuted: Boolean(payload.isMuted),
            isDeafened: Boolean(payload.isDeafened),
            isSpeaking: Boolean(payload.isSpeaking),
          })
          this.emitPeers()
        }
      })
      .subscribe(async (status: string) => {
        if (status === "SUBSCRIBED") {
          this.subscribed = true
          await this.syncPresence()
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          this.onError?.("Voice signaling connection problem — try leaving and rejoining the lounge.")
        }
      })

    return true
  }

  public leave() {
    this.joined = false
    this.subscribed = false

    if (this.vadInterval) {
      clearInterval(this.vadInterval)
      this.vadInterval = null
    }
    if (typeof document !== "undefined" && this.unlockHandler) {
      document.removeEventListener("click", this.unlockHandler)
      document.removeEventListener("touchend", this.unlockHandler)
      this.unlockHandler = null
    }
    if (this.audioCtx) {
      try { this.audioCtx.close() } catch {}
      this.audioCtx = null
    }
    this.analyser = null
    if (this.localStream) {
      for (const track of this.localStream.getTracks()) track.stop()
      this.localStream = null
    }

    for (const t of this.disconnectTimers.values()) clearTimeout(t)
    for (const t of this.recreateTimers.values()) clearTimeout(t)
    this.disconnectTimers.clear()
    this.recreateTimers.clear()
    this.recoverAttempts.clear()
    this.gaveUp.clear()
    this.pendingCandidates.clear()

    for (const peerId of Array.from(this.peerLinks.keys())) this.closeLink(peerId)

    if (this.sigChannel) {
      try { this.sigChannel.untrack() } catch {}
      supabase.removeChannel(this.sigChannel)
      this.sigChannel = null
    }
    this.peersMeta.clear()
    this.emitPeers()
  }

  // ───────────────────────────── presence ─────────────────────────────

  private async syncPresence() {
    if (!this.sigChannel || !this.subscribed) return
    try {
      await this.sigChannel.track({
        userId: this.myUserId,
        username: this.myUsername,
        avatarUrl: this.myAvatarUrl,
        isMuted: this.isMuted,
        isDeafened: this.isDeafened,
      })
    } catch (err) {
      console.warn("Failed to update voice presence:", err)
    }
  }

  private shouldInitiate(peerId: string): boolean {
    // Deterministic rule so both sides never offer at the same time.
    return this.myPeerId < peerId
  }

  private handlePresenceSync() {
    if (!this.sigChannel || !this.joined) return
    const state = this.sigChannel.presenceState()
    const activeIds = new Set<string>([this.myPeerId])

    for (const peerKey of Object.keys(state)) {
      const presences = state[peerKey]
      if (!Array.isArray(presences) || presences.length === 0) continue
      if (peerKey === this.myPeerId) continue

      const info = presences[presences.length - 1] as any // latest tracked state
      const remoteUserId: string = info.userId || peerKey.split(":")[0]

      // Same account in another tab/device: don't connect to ourselves (avoids echo).
      if (remoteUserId === this.myUserId) continue

      activeIds.add(peerKey)
      const prev = this.peersMeta.get(peerKey)
      this.peersMeta.set(peerKey, {
        userId: remoteUserId,
        peerId: peerKey,
        username: info.username || "Fellow",
        avatarUrl: info.avatarUrl || "",
        // Presence is re-tracked on every mute/deafen change, so late joiners see the truth.
        isMuted: Boolean(info.isMuted),
        isDeafened: Boolean(info.isDeafened),
        isSpeaking: prev ? prev.isSpeaking : false,
        connectedState: prev?.connectedState || "connecting",
      })

      if (!this.peerLinks.has(peerKey) && !this.recreateTimers.has(peerKey) && !this.gaveUp.has(peerKey)) {
        void this.createPeerConnection(peerKey, this.shouldInitiate(peerKey))
      }
    }

    for (const existingId of Array.from(this.peersMeta.keys())) {
      if (!activeIds.has(existingId)) this.removePeer(existingId)
    }
    this.emitPeers()
  }

  // ───────────────────────────── peer connections ─────────────────────────────

  private sendSignal(event: string, payload: Record<string, any>) {
    this.sigChannel?.send({ type: "broadcast", event, payload })
  }

  private async createPeerConnection(peerId: string, initiator: boolean): Promise<PeerLink> {
    const existing = this.peerLinks.get(peerId)
    if (existing) return existing

    const pc = new RTCPeerConnection(this.rtcConfig)
    const link: PeerLink = { pc, connId: initiator ? newId() : null, initiator, createdAt: Date.now() }
    this.peerLinks.set(peerId, link)

    if (this.localStream) {
      for (const track of this.localStream.getAudioTracks()) pc.addTrack(track, this.localStream)
    }

    pc.onicecandidate = (event) => {
      if (!event.candidate || !link.connId || this.peerLinks.get(peerId) !== link) return
      this.sendSignal("webrtc-ice", {
        senderId: this.myPeerId,
        targetId: peerId,
        connId: link.connId,
        candidate: event.candidate.toJSON(),
      })
    }

    pc.onconnectionstatechange = () => {
      if (this.peerLinks.get(peerId) !== link) return // stale connection
      this.onLinkStateChanged(peerId, link)
    }

    pc.ontrack = (event) => {
      if (this.peerLinks.get(peerId) !== link) return
      const stream = event.streams?.[0] ?? new MediaStream([event.track])
      this.attachRemoteAudio(peerId, stream)
    }

    if (initiator) {
      try {
        const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: false })
        await pc.setLocalDescription(offer)
        if (this.peerLinks.get(peerId) !== link) return link
        this.sendSignal("webrtc-offer", {
          senderId: this.myPeerId,
          targetId: peerId,
          connId: link.connId,
          sdp: pc.localDescription,
        })
      } catch (err) {
        console.warn("Failed to create WebRTC offer:", err)
        this.recoverPeer(peerId)
      }
    }
    return link
  }

  private async handleRemoteOffer(senderId: string, connId: string, sdp: RTCSessionDescriptionInit) {
    if (!senderId || !connId || !sdp) return
    // Never answer another session of our own account.
    if (senderId.startsWith(`${this.myUserId}:`)) return
    // Under the deterministic rule only the smaller id offers; ignore anything else.
    if (this.shouldInitiate(senderId)) return

    try {
      let link = this.peerLinks.get(senderId)
      // The peer rebuilt its connection (new connId): drop ours and start fresh.
      if (link && link.connId && link.connId !== connId) {
        this.closeLink(senderId)
        link = undefined
      }
      if (!link) link = await this.createPeerConnection(senderId, false)
      link.connId = connId
      const pc = link.pc

      await pc.setRemoteDescription(new RTCSessionDescription(sdp))
      await this.flushPendingIce(senderId, link)

      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)
      if (this.peerLinks.get(senderId) !== link) return

      this.sendSignal("webrtc-answer", {
        senderId: this.myPeerId,
        targetId: senderId,
        connId,
        sdp: pc.localDescription,
      })
    } catch (err) {
      console.warn("Error handling remote WebRTC offer:", err)
    }
  }

  private async handleRemoteAnswer(senderId: string, connId: string, sdp: RTCSessionDescriptionInit) {
    try {
      const link = this.peerLinks.get(senderId)
      if (!link || !link.initiator || link.connId !== connId) return // stale answer
      if (link.pc.signalingState === "have-local-offer") {
        await link.pc.setRemoteDescription(new RTCSessionDescription(sdp))
        await this.flushPendingIce(senderId, link)
      }
    } catch (err) {
      console.warn("Error handling remote WebRTC answer:", err)
    }
  }

  private async handleRemoteIce(senderId: string, connId: string, candidate: RTCIceCandidateInit) {
    if (!candidate || !connId) return
    const link = this.peerLinks.get(senderId)
    if (link && link.connId === connId && link.pc.remoteDescription) {
      try {
        await link.pc.addIceCandidate(new RTCIceCandidate(candidate))
      } catch (err) {
        console.warn("Error adding remote ICE candidate:", err)
      }
      return
    }
    const queue = this.pendingCandidates.get(senderId) || []
    queue.push({ connId, candidate })
    if (queue.length > 100) queue.splice(0, queue.length - 100)
    this.pendingCandidates.set(senderId, queue)
  }

  private async flushPendingIce(senderId: string, link: PeerLink) {
    const queued = this.pendingCandidates.get(senderId) || []
    this.pendingCandidates.delete(senderId)
    for (const item of queued) {
      if (item.connId !== link.connId) continue // belongs to an older connection attempt
      try {
        await link.pc.addIceCandidate(new RTCIceCandidate(item.candidate))
      } catch (err) {
        console.warn("Error flushing queued ICE candidate:", err)
      }
    }
  }

  // ───────────────────────────── recovery ─────────────────────────────

  private onLinkStateChanged(peerId: string, link: PeerLink) {
    const state = link.pc.connectionState
    const meta = this.peersMeta.get(peerId)
    if (meta) {
      this.peersMeta.set(peerId, { ...meta, connectedState: state })
      this.emitPeers()
    }

    if (state === "connected") {
      const t = this.disconnectTimers.get(peerId)
      if (t) clearTimeout(t)
      this.disconnectTimers.delete(peerId)
      this.recoverAttempts.delete(peerId)
      return
    }

    if (state === "disconnected") {
      // Often transient (network blip). Give it a few seconds before rebuilding.
      if (!this.disconnectTimers.has(peerId)) {
        this.disconnectTimers.set(
          peerId,
          setTimeout(() => {
            this.disconnectTimers.delete(peerId)
            if (this.peerLinks.get(peerId) === link && link.pc.connectionState !== "connected") {
              this.recoverPeer(peerId)
            }
          }, DISCONNECT_GRACE_MS)
        )
      }
      return
    }

    if (state === "failed") this.recoverPeer(peerId)
  }

  /** Tear down a broken connection and build a fresh one (with backoff). */
  private recoverPeer(peerId: string) {
    if (!this.joined || !this.peersMeta.has(peerId)) return

    const attempts = (this.recoverAttempts.get(peerId) || 0) + 1
    this.recoverAttempts.set(peerId, attempts)
    this.closeLink(peerId)

    if (attempts > MAX_RECOVERY_ATTEMPTS) {
      this.gaveUp.add(peerId)
      const meta = this.peersMeta.get(peerId)
      if (meta) {
        this.peersMeta.set(peerId, { ...meta, connectedState: "failed" })
        this.emitPeers()
        this.onError?.(`Lost the audio connection with ${meta.username}. Try leaving and rejoining the lounge.`)
      }
      return
    }

    const existingTimer = this.recreateTimers.get(peerId)
    if (existingTimer) clearTimeout(existingTimer)
    this.recreateTimers.set(
      peerId,
      setTimeout(() => {
        this.recreateTimers.delete(peerId)
        if (!this.joined || !this.sigChannel || !this.peersMeta.has(peerId) || this.peerLinks.has(peerId)) return
        const initiator = this.shouldInitiate(peerId)
        void this.createPeerConnection(peerId, initiator)
        // The non-initiator can't offer, so ask the initiator to re-offer on a fresh connection.
        if (!initiator) this.sendSignal("webrtc-reconnect", { senderId: this.myPeerId, targetId: peerId })
      }, Math.min(1000 * attempts, 5000))
    )
  }

  private handleReconnectRequest(senderId: string) {
    if (!this.joined || !senderId || !this.peersMeta.has(senderId)) return
    if (!this.shouldInitiate(senderId)) return // only the initiator re-offers
    const link = this.peerLinks.get(senderId)
    if (
      link &&
      link.initiator &&
      (link.pc.connectionState === "new" || link.pc.connectionState === "connecting") &&
      Date.now() - link.createdAt < 4000
    ) {
      return // we're already mid-handshake
    }
    this.closeLink(senderId)
    void this.createPeerConnection(senderId, true)
  }

  /** Close one connection but keep the peer's presence/meta (used for rebuilds). */
  private closeLink(peerId: string) {
    const link = this.peerLinks.get(peerId)
    if (link) {
      this.peerLinks.delete(peerId) // delete first so late events from this pc are ignored
      link.pc.onicecandidate = null
      link.pc.onconnectionstatechange = null
      link.pc.ontrack = null
      try { link.pc.close() } catch {}
    }
    const audioEl = this.audioElements.get(peerId)
    if (audioEl) {
      audioEl.srcObject = null
      audioEl.remove()
      this.audioElements.delete(peerId)
    }
    const t = this.disconnectTimers.get(peerId)
    if (t) clearTimeout(t)
    this.disconnectTimers.delete(peerId)
  }

  /** The peer actually left: forget everything about them. */
  private removePeer(peerId: string) {
    this.closeLink(peerId)
    const rt = this.recreateTimers.get(peerId)
    if (rt) clearTimeout(rt)
    this.recreateTimers.delete(peerId)
    this.recoverAttempts.delete(peerId)
    this.pendingCandidates.delete(peerId)
    this.gaveUp.delete(peerId)
    this.peersMeta.delete(peerId)
  }

  // ───────────────────────────── audio ─────────────────────────────

  private attachRemoteAudio(peerId: string, stream: MediaStream) {
    if (typeof document === "undefined") return
    let audioEl = this.audioElements.get(peerId)
    if (!audioEl) {
      audioEl = document.createElement("audio")
      audioEl.autoplay = true
      ;(audioEl as any).playsInline = true
      audioEl.style.display = "none"
      document.body.appendChild(audioEl) // in the DOM = more reliable playback on Safari/WebViews
      this.audioElements.set(peerId, audioEl)
    }
    const userId = this.peersMeta.get(peerId)?.userId || peerId.split(":")[0]
    audioEl.srcObject = stream
    audioEl.muted = this.isDeafened
    audioEl.volume = this.peerVolumes.get(userId) ?? 1.0
    audioEl.play().catch(() => {
      // Blocked until a user gesture; the click/touch unlock handler retries.
    })
  }

  /** Retry blocked playback and resume a suspended AudioContext (called on user gestures). */
  public resumeAudio() {
    if (this.audioCtx && this.audioCtx.state === "suspended") {
      this.audioCtx.resume().catch(() => {})
    }
    for (const el of this.audioElements.values()) {
      if (el.paused && el.srcObject) el.play().catch(() => {})
    }
  }

  private setupVoiceActivityDetection(stream: MediaStream) {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
      if (!AudioContextClass) return
      this.audioCtx = new AudioContextClass()
      this.audioCtx?.resume?.().catch(() => {})
      const source = this.audioCtx!.createMediaStreamSource(stream)
      this.analyser = this.audioCtx!.createAnalyser()
      this.analyser.fftSize = 1024
      source.connect(this.analyser)

      const samples = new Uint8Array(this.analyser.fftSize)
      this.vadInterval = setInterval(() => {
        if (!this.analyser || this.isMuted || this.isDeafened) {
          if (this.isSpeaking) {
            this.isSpeaking = false
            this.updateMyVoiceState()
          }
          return
        }

        // RMS of the time-domain signal, with hysteresis so it doesn't flicker.
        this.analyser.getByteTimeDomainData(samples)
        let sumSquares = 0
        for (let i = 0; i < samples.length; i++) {
          const v = (samples[i] - 128) / 128
          sumSquares += v * v
        }
        const rms = Math.sqrt(sumSquares / samples.length)

        const now = Date.now()
        const threshold = this.isSpeaking ? VAD_OFF_LEVEL : VAD_ON_LEVEL
        if (rms > threshold) this.lastLoudAt = now
        const nowSpeaking = now - this.lastLoudAt < VAD_HOLD_MS

        if (nowSpeaking !== this.isSpeaking) {
          this.isSpeaking = nowSpeaking
          this.updateMyVoiceState()
        }
      }, VAD_INTERVAL_MS)
    } catch {
      // Ignore AudioContext errors
    }
  }

  // ───────────────────────────── local controls ─────────────────────────────

  private updateMyVoiceState() {
    const me = this.peersMeta.get(this.myPeerId)
    if (me) {
      this.peersMeta.set(this.myPeerId, {
        ...me,
        isMuted: this.isMuted,
        isDeafened: this.isDeafened,
        isSpeaking: this.isSpeaking,
      })
      this.emitPeers()
    }
    this.sendSignal("voice-state", {
      peerId: this.myPeerId,
      userId: this.myUserId,
      isMuted: this.isMuted,
      isDeafened: this.isDeafened,
      isSpeaking: this.isSpeaking,
    })
  }

  private applyMicEnabled() {
    if (!this.localStream) return
    for (const track of this.localStream.getAudioTracks()) {
      track.enabled = !this.isMuted && !this.isDeafened
    }
  }

  public setMuted(muted: boolean) {
    if (!muted && !this.localStream) {
      // Listen-only: there is no microphone to unmute.
      this.isMuted = true
      this.onError?.("No microphone available — you're in listen-only mode.")
      this.updateMyVoiceState()
      void this.syncPresence()
      return
    }
    this.isMuted = muted
    this.applyMicEnabled()
    if (muted) this.isSpeaking = false
    this.updateMyVoiceState()
    void this.syncPresence() // keep presence truthful for people who join later
  }

  public setDeafened(deafened: boolean) {
    this.isDeafened = deafened
    this.applyMicEnabled()
    for (const audioEl of this.audioElements.values()) audioEl.muted = this.isDeafened
    if (deafened) this.isSpeaking = false
    this.updateMyVoiceState()
    void this.syncPresence()
  }

  /** Accepts a userId (what the UI uses) or a peerId. Volume is remembered across reconnects. */
  public setPeerVolume(remoteId: string, volume: number) {
    const clamped = Math.max(0, Math.min(1, volume))
    const meta = this.peersMeta.get(remoteId)
    const userId = meta?.userId || remoteId.split(":")[0]
    this.peerVolumes.set(userId, clamped)
    for (const [peerId, el] of this.audioElements) {
      if ((this.peersMeta.get(peerId)?.userId || peerId.split(":")[0]) === userId) el.volume = clamped
    }
  }

  private emitPeers() {
    this.onPeersChanged(Array.from(this.peersMeta.values()))
  }
}
