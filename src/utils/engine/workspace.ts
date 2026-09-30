/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * BeamDrop Persistent Team Workspace Engine (Pro Mesh)
 * Supports custom workspace slugs (/w/:slug), PIN protection,
 * and unified virtual signaling across cross-network teams.
 */

export interface WorkspaceNode {
  id: string;
  name: string;
  deviceType: 'phone' | 'laptop' | 'desktop';
  icon: string;
  ip?: string;
  latency?: number;
  lastSeen: number;
}

export interface WorkspaceInfo {
  slug: string;
  name: string;
  hasPin: boolean;
  memberCount: number;
  tier: 'free' | 'pro' | 'enterprise';
}

const STORAGE_KEY_PREFIX = 'beamdrop_ws_';

export class WorkspaceManager {
  public currentSlug: string = '';
  public isAuthenticated: boolean = false;
  private heartbeatInterval: any = null;

  constructor() {}

  public async hashPin(pin: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode('beamdrop_pin_salt_' + pin.trim());
    const hashBuf = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  public getSavedPin(slug: string): string | null {
    try {
      return localStorage.getItem(STORAGE_KEY_PREFIX + slug);
    } catch (_) {
      return null;
    }
  }

  public savePin(slug: string, pin: string) {
    try {
      localStorage.setItem(STORAGE_KEY_PREFIX + slug, pin);
    } catch (_) {}
  }

  public async announceInWorkspace(
    slug: string,
    pin: string,
    myDevice: { id: string; name: string; deviceType: string; icon: string }
  ): Promise<{ success: boolean; nodes: WorkspaceNode[]; error?: string }> {
    try {
      const pinHash = await this.hashPin(pin);
      const res = await fetch('/api/mesh/workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'announce',
          slug,
          pinHash,
          device: myDevice
        })
      });

      if (!res.ok) {
        throw new Error('Workspace authentication failed');
      }

      const json = await res.json();
      if (json.success) {
        this.currentSlug = slug;
        this.isAuthenticated = true;
        this.savePin(slug, pin);
        return { success: true, nodes: json.nodes || [] };
      }
      return { success: false, nodes: [], error: json.error || 'Invalid PIN' };
    } catch (err: any) {
      return { success: false, nodes: [], error: err?.message || 'Connection failed' };
    }
  }

  public async getWorkspaceNodes(slug: string, pin: string): Promise<WorkspaceNode[]> {
    try {
      const pinHash = await this.hashPin(pin);
      const res = await fetch('/api/mesh/workspace?slug=' + encodeURIComponent(slug) + '&pinHash=' + pinHash);
      if (res.ok) {
        const json = await res.json();
        return json.nodes || [];
      }
    } catch (_) {}
    return [];
  }

  public startHeartbeat(
    slug: string,
    pin: string,
    myDevice: { id: string; name: string; deviceType: string; icon: string },
    onUpdate: (nodes: WorkspaceNode[]) => void
  ) {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(async () => {
      const nodes = await this.getWorkspaceNodes(slug, pin);
      onUpdate(nodes);
    }, 4000);
  }

  public stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }
}

export const workspaceEngine = new WorkspaceManager();
