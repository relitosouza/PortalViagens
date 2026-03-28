'use client';

import React from 'react';

export interface ButtonProps {
  label: string;
  onClick?: () => void;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'success';
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  style?: React.CSSProperties;
  fullWidth?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const Button: React.FC<ButtonProps> = ({
  label,
  onClick,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  className,
  style,
  fullWidth = false,
  size = 'md',
}) => {
  const handleClick = onClick || onPress;

  // Web styles
  const baseStyle =
    'font-semibold rounded-lg transition-colors focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed';

  const variants = {
    primary: 'bg-blue-600 hover:bg-blue-700 text-white',
    secondary: 'bg-gray-200 hover:bg-gray-300 text-gray-900',
    danger: 'bg-red-600 hover:bg-red-700 text-white',
    success: 'bg-green-600 hover:bg-green-700 text-white',
  };

  const sizes = {
    sm: 'px-3 py-1 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
  };

  const widthClass = fullWidth ? 'w-full' : '';

  const buttonClasses = `
    ${baseStyle}
    ${variants[variant]}
    ${sizes[size]}
    ${widthClass}
    ${className || ''}
  `.trim();

  return (
    <button
      onClick={handleClick}
      disabled={disabled || loading}
      className={buttonClasses}
      style={style}
    >
      {loading ? (
        <span className="inline-block animate-spin">⏳</span>
      ) : (
        label
      )}
    </button>
  );
};
