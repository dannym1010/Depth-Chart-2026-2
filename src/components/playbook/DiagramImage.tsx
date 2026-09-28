import React from 'react';
import { useDiagramSrc } from '../../utils/playDiagrams';

/** A play diagram (saved in the cloud or just read from a PDF); a soft placeholder while it loads. */
export const DiagramImage: React.FC<{ url?: string; alt: string; className?: string; loading?: 'lazy' | 'eager' }> = ({ url, alt, className, loading }) => {
  const src = useDiagramSrc(url);
  if (!src) return <span className={`block bg-slate-100 dark:bg-slate-800 animate-pulse ${className || ''}`} style={{ minHeight: 24 }} aria-label={alt} />;
  return <img src={src} alt={alt} loading={loading} className={className} />;
};
