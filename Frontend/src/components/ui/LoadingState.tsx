import { Blocks } from 'loading-dev';

interface LoadingCardProps {
  label?: string;
  size?: number;
  className?: string;
}

/**
 * Premium, minimalist loading surface using loading-dev Blocks.
 */
export function LoadingCard({
  label = 'Loading live records...',
  size = 28,
  className = '',
}: LoadingCardProps) {
  return (
    <div
      className={`py-24 flex flex-col items-center justify-center text-center space-y-4 ${className}`}
    >
      <div className="flex items-center justify-center p-3.5 rounded-2xl bg-[var(--color-surface-soft)] text-[var(--color-primary)]">
        <Blocks size={size} color="#000000" />
      </div>
      <p className="text-[12px] font-semibold tracking-wider text-[var(--color-steel)] uppercase">
        {label}
      </p>
    </div>
  );
}

interface ButtonSpinnerProps {
  size?: number;
  color?: string;
}

/**
 * Inline button spinner for async processing states.
 */
export function ButtonSpinner({ size = 16, color = '#ffffff' }: ButtonSpinnerProps) {
  return (
    <span className="inline-flex items-center justify-center">
      <Blocks size={size} color={color} />
    </span>
  );
}

export { Blocks } from 'loading-dev';

export function BlocksSize() {
  return (
    <div className="flex items-center gap-6">
      <Blocks size={16} />
      <Blocks size={24} />
      <Blocks size={40} />
    </div>
  );
}

