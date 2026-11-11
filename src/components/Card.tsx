import React from 'react';

export type CardVariant =
  | 'default'
  | 'dark'
  | 'darkSubtle'
  | 'terracotta'
  | 'subtle'
  | 'warning'
  | 'critical';
export type CardPadding = 'none' | 'sm' | 'md' | 'lg';
export type CardTopAccent = 'none' | 'orange' | 'emerald' | 'amber' | 'rose' | 'sky' | 'teal';

export interface CardProps extends React.HTMLAttributes<HTMLElement> {
  as?: 'div' | 'section' | 'article' | 'form' | 'aside' | 'main';
  variant?: CardVariant;
  padding?: CardPadding;
  topAccent?: CardTopAccent;
  interactive?: boolean;
  className?: string;
  children?: React.ReactNode;
  onSubmit?: React.FormEventHandler<any>;
}

const VARIANT_STYLES: Record<CardVariant, string> = {
  default: 'bg-white border border-slate-200/90 shadow-xs text-slate-950',
  dark: 'bg-gradient-to-br from-[#0B1120] via-[#0F172A] to-[#1E293B] border border-slate-800 shadow-md text-white',
  darkSubtle: 'bg-slate-900/95 border border-slate-800 shadow-xs text-white',
  terracotta: 'bg-gradient-to-r from-white via-orange-50/30 to-amber-50/40 border border-slate-200/90 shadow-xs text-slate-950',
  subtle: 'bg-slate-50/95 border border-slate-200/90 shadow-2xs text-slate-950',
  warning: 'bg-gradient-to-br from-amber-950/90 via-slate-900 to-slate-950 border border-amber-500/80 shadow-md text-white',
  critical: 'bg-gradient-to-br from-rose-950/95 via-slate-900 to-rose-900/90 border border-rose-500/80 shadow-lg shadow-rose-950/40 text-white',
};

const PADDING_STYLES: Record<CardPadding, string> = {
  none: 'p-0',
  sm: 'p-2 sm:p-4',
  md: 'p-2.5 sm:p-5',
  lg: 'p-2.5 sm:p-6',
};

const TOP_ACCENT_STYLES: Record<CardTopAccent, string> = {
  none: '',
  orange: 'border-t-3 sm:border-t-4 border-t-orange-600',
  emerald: 'border-t-3 sm:border-t-4 border-t-emerald-600',
  amber: 'border-t-3 sm:border-t-4 border-t-amber-500',
  rose: 'border-t-3 sm:border-t-4 border-t-rose-600',
  sky: 'border-t-3 sm:border-t-4 border-t-sky-600',
  teal: 'border-t-3 sm:border-t-4 border-t-teal-600',
};

export const Card = React.forwardRef<HTMLElement, CardProps>(
  (
    {
      as: asComponent = 'div',
      variant = 'default',
      padding = 'md',
      topAccent = 'none',
      interactive = false,
      className = '',
      children,
      ...props
    },
    ref
  ) => {
    const variantClass = VARIANT_STYLES[variant] || VARIANT_STYLES.default;
    const paddingClass = PADDING_STYLES[padding];
    const topAccentClass = TOP_ACCENT_STYLES[topAccent];
    const interactiveClass = interactive
      ? 'hover:shadow-md hover:-translate-y-0.5 transition-all duration-150 cursor-pointer'
      : '';

    const Component: any = asComponent;

    return (
      <Component
        ref={ref}
        className={`rounded-xl sm:rounded-2xl overflow-hidden ${variantClass} ${paddingClass} ${topAccentClass} ${interactiveClass} ${className}`}
        {...props}
      >
        {children}
      </Component>
    );
  }
);
Card.displayName = 'Card';

export interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
  bordered?: boolean;
  borderVariant?: 'light' | 'dark';
  children: React.ReactNode;
}

export const CardHeader: React.FC<CardHeaderProps> = ({
  className = '',
  bordered = false,
  borderVariant = 'light',
  children,
  ...props
}) => {
  const borderClass = bordered
    ? borderVariant === 'dark'
      ? 'border-b border-slate-800/90 pb-2 sm:pb-3.5 mb-2.5 sm:mb-4'
      : 'border-b border-slate-100 pb-2 sm:pb-3.5 mb-2.5 sm:mb-4'
    : 'mb-2 sm:mb-3';

  return (
    <div
      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3 ${borderClass} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};

export interface CardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  as?: 'h1' | 'h2' | 'h3' | 'h4';
  className?: string;
  children: React.ReactNode;
}

export const CardTitle: React.FC<CardTitleProps> = ({
  as: Component = 'h3',
  className = '',
  children,
  ...props
}) => {
  return (
    <Component
      className={`text-xs sm:text-lg font-extrabold tracking-tight text-inherit ${className}`}
      {...props}
    >
      {children}
    </Component>
  );
};

export interface CardDescriptionProps extends React.HTMLAttributes<HTMLParagraphElement> {
  className?: string;
  variant?: 'light' | 'dark';
  children: React.ReactNode;
}

export const CardDescription: React.FC<CardDescriptionProps> = ({
  className = '',
  variant = 'light',
  children,
  ...props
}) => {
  const colorClass = variant === 'dark' ? 'text-slate-200 font-medium' : 'text-slate-700 font-medium';
  return (
    <p className={`text-[10px] sm:text-xs ${colorClass} mt-0.5 leading-snug sm:leading-relaxed ${className}`} {...props}>
      {children}
    </p>
  );
};

export interface CardContentProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
  children: React.ReactNode;
}

export const CardContent: React.FC<CardContentProps> = ({
  className = '',
  children,
  ...props
}) => {
  return (
    <div className={`space-y-2.5 sm:space-y-4 ${className}`} {...props}>
      {children}
    </div>
  );
};

export interface CardFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
  bordered?: boolean;
  borderVariant?: 'light' | 'dark';
  children: React.ReactNode;
}

export const CardFooter: React.FC<CardFooterProps> = ({
  className = '',
  bordered = true,
  borderVariant = 'light',
  children,
  ...props
}) => {
  const borderClass = bordered
    ? borderVariant === 'dark'
      ? 'border-t border-slate-800/80'
      : 'border-t border-slate-100'
    : '';

  return (
    <div
      className={`flex items-center justify-between gap-3 pt-3.5 ${borderClass} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
