import type { HTMLAttributes } from 'react';
import './SpatialSurface.css';

export function SpatialSurface({ matched = false, className = '', ...props }: HTMLAttributes<HTMLDivElement> & { matched?: boolean }) {
  return <div {...props} className={`spatial-surface${matched ? ' spatial-surface--matched' : ''} ${className}`} />;
}
