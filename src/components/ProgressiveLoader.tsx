import React from 'react';

type ProgressiveLoaderProps = {
  label?: string;
  fullscreen?: boolean;
  dark?: boolean;
};

export const ProgressiveLoader: React.FC<ProgressiveLoaderProps> = ({
  label = 'Loading',
  fullscreen = false,
  dark = false,
}) => {
  return (
    <div
      className={`flex items-center justify-center px-4 ${
        fullscreen ? 'min-h-screen' : 'min-h-[50vh]'
      } ${dark ? 'bg-slate-950 text-slate-100' : 'bg-white text-slate-900'}`}
      role="status"
      aria-live="polite"
    >
      <div className="flex w-full max-w-[220px] flex-col items-center gap-8">
        <div className="progressive-loader" aria-hidden="true" />
        <div className="w-full space-y-3 text-center">
          <p className={`text-xs font-bold uppercase tracking-[0.18em] ${dark ? 'text-slate-300' : 'text-slate-500'}`}>
            {label}
          </p>
          <div className={`progressive-loader-track ${dark ? 'progressive-loader-track-dark' : ''}`}>
            <div className="progressive-loader-bar" />
          </div>
        </div>
      </div>
    </div>
  );
};
