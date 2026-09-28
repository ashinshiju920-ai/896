/**
 * LazyImage — Progressive lazy-loading image component.
 *
 * Features:
 * - Native lazy loading (`loading="lazy"`) for below-fold images
 * - Priority / eager loading for above-fold images (`priority` prop)
 * - Blur-up placeholder while loading (no layout shift)
 * - Fade-in animation on load complete
 * - Graceful fallback on error
 * - Proper `width`/`height` to prevent CLS (Cumulative Layout Shift)
 * - `decoding="async"` for non-blocking decode on main thread
 * - `fetchPriority` hint for critical LCP images
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';

interface LazyImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  /** When true, loads eagerly (for above-fold / LCP images) */
  priority?: boolean;
  /** Fallback element shown on error */
  fallback?: React.ReactNode;
  /** Wrapper className */
  wrapperClassName?: string;
  /** Show skeleton shimmer while loading */
  showSkeleton?: boolean;
}

export const LazyImage: React.FC<LazyImageProps> = ({
  src,
  alt,
  priority = false,
  fallback,
  wrapperClassName = '',
  showSkeleton = true,
  className = '',
  onLoad,
  onError,
  ...rest
}) => {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // If image is already cached (complete on mount), mark as loaded immediately
  useEffect(() => {
    if (imgRef.current?.complete && imgRef.current.naturalWidth > 0) {
      setLoaded(true);
    }
  }, []);

  const handleLoad = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      setLoaded(true);
      onLoad?.(e);
    },
    [onLoad]
  );

  const handleError = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      setError(true);
      onError?.(e);
    },
    [onError]
  );

  if (error && fallback) {
    return <>{fallback}</>;
  }

  return (
    <span className={`relative inline-block overflow-hidden ${wrapperClassName}`}>
      {/* Skeleton shimmer shown while loading */}
      {showSkeleton && !loaded && !error && (
        <span
          aria-hidden="true"
          className="absolute inset-0 bg-slate-100 animate-pulse rounded-inherit"
          style={{ borderRadius: 'inherit' }}
        />
      )}

      <img
        ref={imgRef}
        src={src}
        alt={alt}
        loading={priority ? 'eager' : 'lazy'}
        decoding={priority ? 'sync' : 'async'}
        // @ts-ignore — fetchpriority is valid HTML but not yet in TS types
        fetchpriority={priority ? 'high' : 'auto'}
        onLoad={handleLoad}
        onError={handleError}
        className={`transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'} ${className}`}
        {...rest}
      />
    </span>
  );
};
