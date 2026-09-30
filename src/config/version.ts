/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * BeamDrop Single-Source Unified Versioning Engine
 * Controls SemVer across Web App, Manifest, Extension Hub & API endpoints.
 */

export const APP_VERSION = {
  major: 1,
  minor: 6,
  patch: 2,
  get full() {
    return this.major + '.' + this.minor + '.' + this.patch;
  },
  releaseDate: '2026-09-30',
  buildHash: 'git-6abcddc3',
  buildTimestamp: 1790762435,
  changelog: [
    'iOS Liquid Glass Visual Overhaul with Specular Refraction',
    'Native File System 1-Click Folder Unpacker (Zero-ZIP)',
    'Streamlined 4-Tab Capsule Navigation (Permanent zero scrollbar)',
    'Sequential Queue Worker for Multi-File Uploads'
  ]
};
