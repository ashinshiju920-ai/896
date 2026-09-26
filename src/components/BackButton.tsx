import React from 'react';
import { ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface BackButtonProps {
  /** Override the default back navigation with a specific path */
  to?: string;
  /** Custom label text. Defaults to "Back" */
  label?: string;
  /** Extra CSS classes */
  className?: string;
}

/**
 * A reusable back-navigation button.
 * - Uses browser history when available (history.length > 1)
 * - Falls back to the `to` prop path, or "/" as a last resort
 */
export const BackButton: React.FC<BackButtonProps> = ({
  to,
  label = 'Back',
  className = '',
}) => {
  const navigate = useNavigate();

  const handleBack = () => {
    if (to) {
      navigate(to);
    } else if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

  return (
    <button
      onClick={handleBack}
      aria-label={label}
      className={`inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-emerald-700 transition-colors group cursor-pointer ${className}`}
    >
      <span className="w-7 h-7 rounded-full bg-slate-100 group-hover:bg-emerald-50 flex items-center justify-center transition-colors">
        <ChevronLeft className="w-4 h-4" />
      </span>
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
};
