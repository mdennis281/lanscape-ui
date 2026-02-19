import React from 'react';

export interface VersionTagStyle {
  color: string;
  background?: string;
}

export const VERSION_TAG_STYLES: Record<string, VersionTagStyle> = {
  alpha: {
    color: '#ff6b6bbb',
  },
  beta: {
    color: '#ffd93dbb',
  },
  rc: {
    color: '#64b5f6bb',
  },
  local: {
    color: '#6bcb77bb',
  },
};

export type VersionTag = 'alpha' | 'beta' | 'rc' | 'local' | null;

/**
 * Determine the version tag based on version string
 */
export function getVersionTag(version: string): VersionTag {
  if (version === '0.0.0') return 'local';
  if (version.includes('rc')) return 'rc';
  if (version.includes('a')) return 'alpha';
  if (version.includes('b')) return 'beta';
  return null;
}

/**
 * Format version string with optional colored tag
 * Returns a React element with the version and optional tag
 */
export function formatVersion(version: string): React.ReactNode {
  const tag = getVersionTag(version);
  
  const tagStyle: React.CSSProperties = tag ? {
    color: VERSION_TAG_STYLES[tag].color,
    background: VERSION_TAG_STYLES[tag].background,
    fontWeight: 500,
    marginLeft: '6px',
  } : {};

  return (
    <>
      v{version}
      {tag && <span style={tagStyle}>({tag === 'rc' ? 'release candidate' : tag})</span>}
    </>
  );
}
