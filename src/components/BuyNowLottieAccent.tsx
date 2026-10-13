import React from 'react';

const LOTTIE_SRC = 'https://lottie.host/3fc0b873-8c25-4e18-b9cf-07706ae2a7c6/Ha2DVS0zWC.lottie';

export const BuyNowLottieAccent: React.FC<{ className?: string }> = ({ className = '' }) => {
  const hostRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const player = document.createElement('dotlottie-player');
    player.setAttribute('src', LOTTIE_SRC);
    player.setAttribute('background', 'transparent');
    player.setAttribute('speed', '1');
    player.setAttribute('loop', '');
    player.setAttribute('autoplay', '');
    player.setAttribute('aria-hidden', 'true');
    player.style.width = '100%';
    player.style.height = '100%';
    player.style.display = 'block';

    host.replaceChildren(player);

    return () => {
      host.replaceChildren();
    };
  }, []);

  return (
    <span
      className={`pointer-events-none absolute -right-2.5 top-1/2 z-10 h-11 w-11 -translate-y-1/2 overflow-visible ${className}`}
      aria-hidden="true"
    >
      <span ref={hostRef} className="block h-full w-full" />
    </span>
  );
};
