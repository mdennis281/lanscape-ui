import React from 'react';

export interface VersionTagStyle {
  color: string;
  background: string;
}

export const VERSION_TAG_STYLES: Record<string, VersionTagStyle> = {
  alpha: {
    color: '#ff6b6b',
    background: 'rgba(255, 107, 107, 0.15)',
  },
  beta: {
    color: '#ffd93d',
    background: 'rgba(255, 217, 61, 0.15)',
  },
  local: {
    color: '#6bcb77',
    background: 'rgba(107, 203, 119, 0.15)',
  },
};

export type VersionTag = 'alpha' | 'beta' | 'local' | null;

/**
 * Determine the version tag based on version string
 */
export function getVersionTag(version: string): VersionTag {
  if (version === '0.0.0') return 'local';
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
    padding: '2px 6px',
    borderRadius: '4px',
    fontSize: '0.85em',
    fontWeight: 500,
    marginLeft: '6px',
  } : {};

  return (
    <>
      v{version}
      {tag && <span style={tagStyle}>({tag})</span>}
    </>
  );
}
