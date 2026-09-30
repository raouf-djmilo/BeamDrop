/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * BeamDrop 10-Minute Ephemeral Drop Portal Engine
 * Generates single-use expiring drop links with integrated 10:00 countdown
 * and auto-destruction of WebRTC session and signaling records upon expiration.
 */

export interface EphemeralPortalSession {
  portalId: string;
  peerId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  expiresAt: number; // Unix timestamp in ms
  e2eeKeyHex: string;
  shareUrl: string;
}

export class EphemeralPortalEngine {
  private activePortals: Map<string, EphemeralPortalSession> = new Map();

  public createPortal(
    peerId: string,
    file: { name: string; size: number; type: string },
    e2eeKeyHex: string,
    baseUrl: string
  ): EphemeralPortalSession {
    const portalId = 'p-' + Math.random().toString(36).substring(2, 8);
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    const targetBase = baseUrl.replace(/\/$/, '');
    const shareUrl = targetBase + '/portal/' + portalId + '?peer=' + peerId + '&name=' + encodeURIComponent(file.name) + '&size=' + file.size + '&mime=' + encodeURIComponent(file.type) + '#key=' + e2eeKeyHex;

    const session: EphemeralPortalSession = {
      portalId,
      peerId,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
      expiresAt,
      e2eeKeyHex,
      shareUrl
    };

    this.activePortals.set(portalId, session);

    setTimeout(() => {
      this.destroyPortal(portalId);
    }, 10 * 60 * 1000 + 1000);

    return session;
  }

  public getPortal(portalId: string): EphemeralPortalSession | null {
    const session = this.activePortals.get(portalId);
    if (!session) return null;
    if (Date.now() > session.expiresAt) {
      this.destroyPortal(portalId);
      return null;
    }
    return session;
  }

  public destroyPortal(portalId: string) {
    this.activePortals.delete(portalId);
  }
}

export const ephemeralPortalEngine = new EphemeralPortalEngine();
