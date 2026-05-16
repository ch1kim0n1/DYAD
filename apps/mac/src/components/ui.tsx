/**
 * Minimal shadcn-style primitives (tech-stack.md).
 *
 * Real shadcn/ui is a CLI that copies Radix-backed components into your
 * tree; we don't want the Radix dependency right now. Instead we ship a
 * small set of Tailwind-styled primitives with the same prop surface
 * (Button.variant, Card, Input, Label, Separator) so views can adopt
 * them incrementally and a future migration to shadcn proper is just a
 * `npx shadcn add` away.
 */
import React from 'react';

function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

type Variant = 'default' | 'destructive' | 'outline' | 'ghost' | 'link';
type Size = 'default' | 'sm' | 'lg' | 'icon';

const baseBtn = 'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50';
const btnVariants: Record<Variant, string> = {
  default:     'bg-accent text-white hover:bg-accent/90',
  destructive: 'bg-red text-white hover:bg-red/90',
  outline:     'border border-border bg-transparent hover:bg-card text-fg',
  ghost:       'hover:bg-card text-fg',
  link:        'text-accent underline-offset-4 hover:underline',
};
const btnSizes: Record<Size, string> = {
  default: 'h-9 px-4 py-2',
  sm:      'h-8 px-3 text-xs',
  lg:      'h-10 px-6',
  icon:    'h-9 w-9',
};

export const Button = React.forwardRef<HTMLButtonElement, {
  variant?: Variant;
  size?: Size;
  className?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ variant = 'default', size = 'default', className, ...rest }, ref) => (
    <button ref={ref} className={cn(baseBtn, btnVariants[variant], btnSizes[size], className)} {...rest} />
  ),
);
Button.displayName = 'Button';

export function Card({ className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-xl border border-border bg-card text-fg', className)} {...rest} />;
}
export function CardHeader({ className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col space-y-1.5 p-5', className)} {...rest} />;
}
export function CardTitle({ className, ...rest }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn('text-base font-semibold leading-tight tracking-tight', className)} {...rest} />;
}
export function CardContent({ className, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-5 pt-0', className)} {...rest} />;
}

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & { className?: string }>(
  ({ className, ...rest }, ref) => (
    <input
      ref={ref}
      className={cn(
        'flex h-9 w-full rounded-md border border-border bg-transparent px-3 py-1 text-sm text-fg placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...rest}
    />
  ),
);
Input.displayName = 'Input';

export function Label({ className, ...rest }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn('text-sm font-medium leading-none', className)} {...rest} />;
}

export function Separator({ className, orientation = 'horizontal' }: { className?: string; orientation?: 'horizontal' | 'vertical' }) {
  return (
    <div
      className={cn(
        'shrink-0 bg-border',
        orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px',
        className,
      )}
      role="separator"
      aria-orientation={orientation}
    />
  );
}

export function Badge({
  variant = 'default',
  className,
  ...rest
}: { variant?: 'default' | 'secondary' | 'outline' | 'destructive'; className?: string } & React.HTMLAttributes<HTMLSpanElement>) {
  const variantClass = {
    default:     'bg-accent/20 text-accent border-accent/30',
    secondary:   'bg-card text-muted border-border',
    outline:     'border-border text-fg',
    destructive: 'bg-red/15 text-red border-red/30',
  }[variant];
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium',
        variantClass,
        className,
      )}
      {...rest}
    />
  );
}
