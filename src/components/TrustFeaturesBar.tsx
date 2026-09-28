import React from 'react';

export const TrustFeaturesBar: React.FC = () => {
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Outer Card Container */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-[0_4px_25px_rgba(0,0,0,0.04)] p-4 sm:p-6 lg:p-8 transition-all">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 lg:gap-0 lg:divide-x lg:divide-slate-200/70">
          
          {/* 1. INSTANT DIGITAL ACCESS */}
          <div className="flex flex-col justify-between bg-slate-50/60 lg:bg-transparent p-3.5 sm:p-5 lg:px-6 lg:py-2 rounded-2xl lg:rounded-none transition-all hover:bg-slate-50/90 lg:hover:bg-slate-50/40">
            <div className="space-y-2.5 sm:space-y-3.5">
              {/* 3D Icon with Celebratory Rays */}
              <div className="relative w-14 h-14 sm:w-16 sm:h-16 lg:w-20 lg:h-20 shrink-0">
                {/* Soft Mint Radial Aura */}
                <div className="absolute inset-0 rounded-full bg-radial from-emerald-100/80 via-emerald-50/40 to-transparent blur-[2px]" />
                
                {/* SVG 3D Cloud + Downward Arrow + Rays */}
                <svg
                  viewBox="0 0 80 80"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-full h-full relative z-10 drop-shadow-[0_6px_10px_rgba(5,150,105,0.22)]"
                >
                  <defs>
                    <linearGradient id="cloudGrad" x1="20" y1="20" x2="60" y2="60" gradientUnits="userSpaceOnUse">
                      <stop offset="0%" stopColor="#34d399" />
                      <stop offset="50%" stopColor="#059669" />
                      <stop offset="100%" stopColor="#047857" />
                    </linearGradient>
                    <linearGradient id="cloudHighlight" x1="40" y1="22" x2="40" y2="38" gradientUnits="userSpaceOnUse">
                      <stop offset="0%" stopColor="#ffffff" stopOpacity="0.6" />
                      <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
                    </linearGradient>
                    <linearGradient id="arrowGrad" x1="40" y1="28" x2="40" y2="52" gradientUnits="userSpaceOnUse">
                      <stop offset="0%" stopColor="#ffffff" />
                      <stop offset="100%" stopColor="#e6fffa" />
                    </linearGradient>
                  </defs>

                  {/* Celebratory Green Sparkle Rays (top-right) */}
                  <line x1="58" y1="18" x2="62" y2="13" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" />
                  <line x1="64" y1="24" x2="71" y2="23" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" />
                  <line x1="63" y1="31" x2="68" y2="34" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" />

                  {/* 3D Glossy Emerald Cloud Body */}
                  <path
                    d="M57.5 48.5C57.5 53.7467 53.2467 58 48 58H25C19.4772 58 15 53.5228 15 48C15 42.8465 18.8953 38.5997 23.8824 38.0531C24.3888 30.6977 30.5284 25 38 25C44.757 25 50.4435 29.7428 51.7828 36.1706C55.0594 37.1352 57.5 40.1701 57.5 44C57.5 45.4549 57.0858 46.8129 56.3688 47.9616C57.0673 48.0697 57.5 48.2435 57.5 48.5Z"
                    fill="url(#cloudGrad)"
                  />
                  {/* Cloud Top Specular Light */}
                  <ellipse cx="38" cy="30" rx="9" ry="4" fill="url(#cloudHighlight)" />

                  {/* 3D White Arrow Down */}
                  <path
                    d="M40 54L31 43H36.5V31H43.5V43H49L40 54Z"
                    fill="url(#arrowGrad)"
                    filter="drop-shadow(0 2px 3px rgba(0,0,0,0.25))"
                  />
                </svg>
              </div>

              {/* Title & Subtitle */}
              <div>
                <h3 className="text-xs sm:text-base lg:text-lg font-bold sm:font-extrabold text-[#0a2540] font-['Plus_Jakarta_Sans',sans-serif] tracking-tight leading-snug">
                  Instant Digital Access
                </h3>
                <p className="text-[11px] sm:text-xs lg:text-sm text-slate-500 font-['DM_Sans',sans-serif] mt-0.5 sm:mt-1 leading-snug sm:leading-relaxed">
                  Get your study materials right after payment.
                </p>
              </div>
            </div>

            {/* Bottom Pill Badge */}
            <div className="pt-2.5 sm:pt-4">
              <span className="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1 rounded-full text-[10px] sm:text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/70 shadow-2xs">
                {/* Lightning Bolt */}
                <svg className="w-3 h-3 text-emerald-600 shrink-0 fill-current" viewBox="0 0 24 24">
                  <path d="M13 2L3 14h8l-2 8 10-12h-8l2-8z" />
                </svg>
                <span>No Waiting!</span>
              </span>
            </div>
          </div>

          {/* 2. HIGH-QUALITY PDF */}
          <div className="flex flex-col justify-between bg-slate-50/60 lg:bg-transparent p-3.5 sm:p-5 lg:px-6 lg:py-2 rounded-2xl lg:rounded-none transition-all hover:bg-slate-50/90 lg:hover:bg-slate-50/40">
            <div className="space-y-2.5 sm:space-y-3.5">
              {/* 3D Icon with Celebratory Rays */}
              <div className="relative w-14 h-14 sm:w-16 sm:h-16 lg:w-20 lg:h-20 shrink-0">
                {/* Soft Blue Radial Aura */}
                <div className="absolute inset-0 rounded-full bg-radial from-sky-100/80 via-sky-50/40 to-transparent blur-[2px]" />

                {/* SVG 3D Blue Document + Red PDF Badge + Rays */}
                <svg
                  viewBox="0 0 80 80"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-full h-full relative z-10 drop-shadow-[0_6px_10px_rgba(2,132,199,0.22)]"
                >
                  <defs>
                    <linearGradient id="docGrad" x1="22" y1="18" x2="54" y2="60" gradientUnits="userSpaceOnUse">
                      <stop offset="0%" stopColor="#38bdf8" />
                      <stop offset="50%" stopColor="#0284c7" />
                      <stop offset="100%" stopColor="#0369a1" />
                    </linearGradient>
                    <linearGradient id="foldGrad" x1="44" y1="18" x2="56" y2="28" gradientUnits="userSpaceOnUse">
                      <stop offset="0%" stopColor="#bae6fd" />
                      <stop offset="100%" stopColor="#7dd3fc" />
                    </linearGradient>
                    <linearGradient id="pdfBadgeGrad" x1="36" y1="46" x2="58" y2="58" gradientUnits="userSpaceOnUse">
                      <stop offset="0%" stopColor="#ef4444" />
                      <stop offset="100%" stopColor="#dc2626" />
                    </linearGradient>
                  </defs>

                  {/* Celebratory Blue Sparkle Rays */}
                  <line x1="56" y1="16" x2="60" y2="12" stroke="#0284c7" strokeWidth="2.5" strokeLinecap="round" />
                  <line x1="63" y1="21" x2="69" y2="20" stroke="#0284c7" strokeWidth="2.5" strokeLinecap="round" />
                  <line x1="61" y1="28" x2="66" y2="30" stroke="#0284c7" strokeWidth="2.5" strokeLinecap="round" />

                  {/* Document Body (with folded corner) */}
                  <path
                    d="M26 18C23.7909 18 22 19.7909 22 22V56C22 58.2091 23.7909 60 26 60H50C52.2091 60 54 58.2091 54 56V28L44 18H26Z"
                    fill="url(#docGrad)"
                  />
                  {/* Folded Top-Right Corner */}
                  <path d="M44 18V26C44 27.1046 44.8954 28 46 28H54L44 18Z" fill="url(#foldGrad)" />

                  {/* White Content Lines */}
                  <rect x="27" y="32" width="22" height="2.5" rx="1.25" fill="#ffffff" fillOpacity="0.8" />
                  <rect x="27" y="38" width="16" height="2.5" rx="1.25" fill="#ffffff" fillOpacity="0.8" />
                  <rect x="27" y="44" width="10" height="2.5" rx="1.25" fill="#ffffff" fillOpacity="0.8" />

                  {/* Red PDF Badge */}
                  <rect x="34" y="45" width="22" height="12" rx="3" fill="url(#pdfBadgeGrad)" filter="drop-shadow(0 2px 3px rgba(0,0,0,0.3))" />
                  <text x="45" y="54" fill="#ffffff" fontSize="7.5" fontWeight="900" fontFamily="sans-serif" textAnchor="middle">PDF</text>
                </svg>
              </div>

              {/* Title & Subtitle */}
              <div>
                <h3 className="text-xs sm:text-base lg:text-lg font-bold sm:font-extrabold text-[#0a2540] font-['Plus_Jakarta_Sans',sans-serif] tracking-tight leading-snug">
                  High-Quality PDF
                </h3>
                <p className="text-[11px] sm:text-xs lg:text-sm text-slate-500 font-['DM_Sans',sans-serif] mt-0.5 sm:mt-1 leading-snug sm:leading-relaxed">
                  Printable and works on all devices.
                </p>
              </div>
            </div>

            {/* Bottom Pill Badge */}
            <div className="pt-2.5 sm:pt-4">
              <span className="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1 rounded-full text-[10px] sm:text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200/70 shadow-2xs">
                {/* Device Icon: Laptop + Screen */}
                <svg className="w-3.5 h-3.5 text-blue-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span>Phone • Tablet • Laptop</span>
              </span>
            </div>
          </div>

          {/* 3. LIFETIME ACCESS */}
          <div className="flex flex-col justify-between bg-slate-50/60 lg:bg-transparent p-3.5 sm:p-5 lg:px-6 lg:py-2 rounded-2xl lg:rounded-none transition-all hover:bg-slate-50/90 lg:hover:bg-slate-50/40">
            <div className="space-y-2.5 sm:space-y-3.5">
              {/* 3D Icon with Celebratory Rays */}
              <div className="relative w-14 h-14 sm:w-16 sm:h-16 lg:w-20 lg:h-20 shrink-0">
                {/* Soft Violet Radial Aura */}
                <div className="absolute inset-0 rounded-full bg-radial from-purple-100/80 via-purple-50/40 to-transparent blur-[2px]" />

                {/* SVG 3D Graduation Cap on Infinity Loop + Rays */}
                <svg
                  viewBox="0 0 80 80"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-full h-full relative z-10 drop-shadow-[0_6px_10px_rgba(124,58,237,0.22)]"
                >
                  <defs>
                    <linearGradient id="infinityGrad" x1="16" y1="36" x2="64" y2="60" gradientUnits="userSpaceOnUse">
                      <stop offset="0%" stopColor="#a855f7" />
                      <stop offset="50%" stopColor="#7c3aed" />
                      <stop offset="100%" stopColor="#6d28d9" />
                    </linearGradient>
                    <linearGradient id="capGrad" x1="28" y1="18" x2="52" y2="34" gradientUnits="userSpaceOnUse">
                      <stop offset="0%" stopColor="#4c1d95" />
                      <stop offset="100%" stopColor="#2e1065" />
                    </linearGradient>
                  </defs>

                  {/* Celebratory Purple Sparkle Rays */}
                  <line x1="58" y1="18" x2="63" y2="14" stroke="#7c3aed" strokeWidth="2.5" strokeLinecap="round" />
                  <line x1="64" y1="25" x2="70" y2="24" stroke="#7c3aed" strokeWidth="2.5" strokeLinecap="round" />

                  {/* 3D Glossy Infinity Loop */}
                  <path
                    d="M29.5 48.5C26 53 20.5 54.5 16 50.5C11.5 46.5 12.5 39.5 17.5 36.5C23 33 30 38.5 40 46C50 53.5 57 59 62.5 55.5C67.5 52.5 68.5 45.5 64 41.5C59.5 37.5 54 39 50.5 43.5L46.5 48.5"
                    stroke="url(#infinityGrad)"
                    strokeWidth="7.5"
                    strokeLinecap="round"
                  />
                  {/* Foreground Loop cross */}
                  <path
                    d="M33 44C36.5 41 43.5 36 50.5 43.5"
                    stroke="url(#infinityGrad)"
                    strokeWidth="7.5"
                    strokeLinecap="round"
                  />

                  {/* 3D Graduation Cap on Top */}
                  {/* Mortarboard Diamond */}
                  <polygon points="40,20 54,25 40,30 26,25" fill="url(#capGrad)" filter="drop-shadow(0 2px 4px rgba(0,0,0,0.3))" />
                  {/* Skull cap under diamond */}
                  <path d="M31 27V32C31 34.5 35 36.5 40 36.5C45 36.5 49 34.5 49 32V27" fill="#1e1b4b" />
                  {/* Cap Button */}
                  <circle cx="40" cy="25" r="1.5" fill="#facc15" />
                  {/* Gold Tassel */}
                  <path d="M40 25C42 27 46 29 47 33" stroke="#facc15" strokeWidth="1.5" strokeLinecap="round" />
                  <circle cx="47" cy="33.5" r="1" fill="#facc15" />
                </svg>
              </div>

              {/* Title & Subtitle */}
              <div>
                <h3 className="text-xs sm:text-base lg:text-lg font-bold sm:font-extrabold text-[#0a2540] font-['Plus_Jakarta_Sans',sans-serif] tracking-tight leading-snug">
                  Lifetime Access
                </h3>
                <p className="text-[11px] sm:text-xs lg:text-sm text-slate-500 font-['DM_Sans',sans-serif] mt-0.5 sm:mt-1 leading-snug sm:leading-relaxed">
                  Keep access to your materials forever.
                </p>
              </div>
            </div>

            {/* Bottom Pill Badge */}
            <div className="pt-2.5 sm:pt-4">
              <span className="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1 rounded-full text-[10px] sm:text-xs font-bold text-purple-700 bg-purple-50 border border-purple-200/70 shadow-2xs">
                {/* Infinity symbol */}
                <svg className="w-3.5 h-3.5 text-purple-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18.178 8c5.096 0 5.096 8 0 8-5.095 0-7.133-8-12.739-8-4.585 0-4.585 8 0 8 5.606 0 7.644-8 12.74-8z" />
                </svg>
                <span>Free Future Updates</span>
              </span>
            </div>
          </div>

          {/* 4. SAFE & SECURE CHECKOUT */}
          <div className="flex flex-col justify-between bg-slate-50/60 lg:bg-transparent p-3.5 sm:p-5 lg:px-6 lg:py-2 rounded-2xl lg:rounded-none transition-all hover:bg-slate-50/90 lg:hover:bg-slate-50/40">
            <div className="space-y-2.5 sm:space-y-3.5">
              {/* 3D Icon with Celebratory Rays */}
              <div className="relative w-14 h-14 sm:w-16 sm:h-16 lg:w-20 lg:h-20 shrink-0">
                {/* Soft Gold Radial Aura */}
                <div className="absolute inset-0 rounded-full bg-radial from-amber-100/80 via-amber-50/40 to-transparent blur-[2px]" />

                {/* SVG 3D Metallic Shield with Checkmark + Rays */}
                <svg
                  viewBox="0 0 80 80"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-full h-full relative z-10 drop-shadow-[0_6px_10px_rgba(217,119,6,0.22)]"
                >
                  <defs>
                    <linearGradient id="shieldRimGrad" x1="22" y1="18" x2="58" y2="62" gradientUnits="userSpaceOnUse">
                      <stop offset="0%" stopColor="#fde68a" />
                      <stop offset="35%" stopColor="#f59e0b" />
                      <stop offset="70%" stopColor="#d97706" />
                      <stop offset="100%" stopColor="#b45309" />
                    </linearGradient>
                    <linearGradient id="shieldBodyGrad" x1="26" y1="22" x2="54" y2="58" gradientUnits="userSpaceOnUse">
                      <stop offset="0%" stopColor="#fffbeb" />
                      <stop offset="30%" stopColor="#fef3c7" />
                      <stop offset="70%" stopColor="#fde68a" />
                      <stop offset="100%" stopColor="#f59e0b" />
                    </linearGradient>
                    <linearGradient id="checkGrad" x1="32" y1="36" x2="48" y2="48" gradientUnits="userSpaceOnUse">
                      <stop offset="0%" stopColor="#b45309" />
                      <stop offset="100%" stopColor="#92400e" />
                    </linearGradient>
                  </defs>

                  {/* Celebratory Golden Sparkle Rays */}
                  <line x1="58" y1="17" x2="63" y2="13" stroke="#d97706" strokeWidth="2.5" strokeLinecap="round" />
                  <line x1="64" y1="23" x2="70" y2="23" stroke="#d97706" strokeWidth="2.5" strokeLinecap="round" />

                  {/* 3D Outer Shield Rim */}
                  <path
                    d="M40 19C48 22 55 21 57 23C58 35 55 52 40 61C25 52 22 35 23 23C25 21 32 22 40 19Z"
                    fill="url(#shieldRimGrad)"
                  />
                  {/* 3D Inner Shield Surface */}
                  <path
                    d="M40 22.5C47 25 52.5 24 54 26C55 36 52 49 40 57.5C28 49 25 36 26 26C27.5 24 33 25 40 22.5Z"
                    fill="url(#shieldBodyGrad)"
                  />

                  {/* 3D Golden Checkmark */}
                  <path
                    d="M33 39.5L37.5 44L47.5 34"
                    stroke="url(#checkGrad)"
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    filter="drop-shadow(0 2px 2px rgba(180,83,9,0.35))"
                  />
                </svg>
              </div>

              {/* Title & Subtitle */}
              <div>
                <h3 className="text-xs sm:text-base lg:text-lg font-bold sm:font-extrabold text-[#0a2540] font-['Plus_Jakarta_Sans',sans-serif] tracking-tight leading-snug">
                  Safe &amp; Secure Checkout
                </h3>
                <p className="text-[11px] sm:text-xs lg:text-sm text-slate-500 font-['DM_Sans',sans-serif] mt-0.5 sm:mt-1 leading-snug sm:leading-relaxed">
                  SSL 256-bit encrypted transactions.
                </p>
              </div>
            </div>

            {/* Bottom Pill Badge */}
            <div className="pt-2.5 sm:pt-4">
              <span className="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1 rounded-full text-[10px] sm:text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200/70 shadow-2xs">
                {/* Padlock Icon */}
                <svg className="w-3.5 h-3.5 text-amber-700 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
                </svg>
                <span>Your Data is Safe</span>
              </span>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
};
