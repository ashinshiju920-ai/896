import React from 'react';

export const CashfreeLogo: React.FC<{ className?: string }> = ({ className = "h-9" }) => {
  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      {/* Cashfree interlocking bracket emblem */}
      <svg className="h-8 w-8 shrink-0" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="48" height="48" rx="10" fill="#f8fafc" />
        <path
          d="M19 12C14.5817 12 11 15.5817 11 20V24C11 25.1046 11.8954 26 13 26H19C23.4183 26 27 22.4183 27 18V14C27 12.8954 26.1046 12 25 12H19Z"
          fill="#00A859"
        />
        <path
          d="M29 36C33.4183 36 37 32.4183 37 28V24C37 22.8954 36.1046 22 35 22H29C24.5817 22 21 25.5817 21 30V34C21 35.1046 21.8954 36 23 36H29Z"
          fill="#F7931E"
        />
      </svg>
      <div className="flex flex-col text-left leading-none select-none">
        <span className="text-[#0d1b2a] font-extrabold text-[19px] tracking-tight font-['Plus_Jakarta_Sans',sans-serif]">
          Cashfree
        </span>
        <span className="text-[#1e293b] font-bold text-[11px] tracking-wider uppercase mt-0.5">
          Payments
        </span>
      </div>
    </div>
  );
};
