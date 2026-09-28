import React, { useState } from 'react';

interface WhatsAppButtonProps {
  phoneNumber?: string;
  defaultMessage?: string;
}

export const WhatsAppButton: React.FC<WhatsAppButtonProps> = ({
  phoneNumber = '916282377918',
  defaultMessage = 'Hi! I have an enquiry regarding Aylem study materials.',
}) => {
  const [isHovered, setIsHovered] = useState(false);

  // Clean phone number (strip spaces, +, dashes)
  const cleanNumber = phoneNumber.replace(/[^0-9]/g, '');
  const encodedMessage = encodeURIComponent(defaultMessage);
  const whatsappUrl = `https://wa.me/${cleanNumber}?text=${encodedMessage}`;

  return (
    <aside
      aria-label="WhatsApp quick contact"
      className="fixed z-40 select-none bottom-[calc(1.25rem+env(safe-area-inset-bottom,0px))] left-[calc(1rem+env(safe-area-inset-left,0px))] print:hidden"
    >
      <div className="relative flex items-center group">
        {/* Floating animated button */}
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          id="whatsapp-floating-btn"
          aria-label="Chat with us on WhatsApp"
          title="Chat with us on WhatsApp (+91 62823 77918)"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          className="relative block rounded-full touch-card transition-transform duration-300 ease-out active:scale-90 hover:scale-105 animate-whatsapp-float focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
        >
          {/* Subtle Expanding Radar Ring Animation */}
          <span
            className="absolute inset-0 rounded-full bg-[#25D366]/40 animate-whatsapp-ring -z-10 pointer-events-none"
            aria-hidden="true"
          />

          {/* Secondary ambient soft glow */}
          <span
            className="absolute -inset-1 rounded-full bg-emerald-500/20 blur-md -z-10 pointer-events-none group-hover:bg-emerald-500/40 transition-colors"
            aria-hidden="true"
          />

          {/* Main 3D Glossy WhatsApp Icon */}
          <div className="relative w-13 h-13 sm:w-15 sm:h-15 drop-shadow-[0_8px_18px_rgba(18,140,126,0.38)] group-hover:drop-shadow-[0_12px_24px_rgba(37,211,102,0.55)] transition-all duration-300">
            <img
              src="/whatsapp-icon.png"
              alt="WhatsApp"
              width="60"
              height="60"
              loading="eager"
              decoding="async"
              className="w-full h-full object-contain pointer-events-none select-none transition-transform duration-300 group-hover:rotate-6"
            />

            {/* Active Online Indicator Badge */}
            <span
              className="absolute top-0.5 right-0.5 sm:top-1 sm:right-1 flex h-3 w-3 sm:h-3.5 sm:w-3.5"
              title="Online now"
            >
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-full w-full bg-emerald-500 border-2 border-white shadow-xs" />
            </span>
          </div>
        </a>

        {/* Desktop Hover Tooltip Pill */}
        <div
          className={`hidden sm:flex items-center gap-1.5 ml-3 px-3 py-1.5 rounded-full bg-slate-900/90 backdrop-blur-md text-white text-xs font-semibold shadow-lg border border-white/10 pointer-events-none transition-all duration-300 origin-left ${
            isHovered
              ? 'opacity-100 translate-x-0 scale-100'
              : 'opacity-0 -translate-x-2 scale-95'
          }`}
          aria-hidden="true"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>Chat with us</span>
        </div>
      </div>
    </aside>
  );
};
