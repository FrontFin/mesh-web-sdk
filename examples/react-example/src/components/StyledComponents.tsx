import React, { HTMLAttributes, InputHTMLAttributes } from 'react'

// Theme object
export const theme = {
  colors: {
    primary: '#3498db',
    background: '#f8f9fa',
    white: '#ffffff',
    text: '#2c3e50',
    error: '#e74c3c',
    border: '#ddd'
  },
  spacing: {
    sm: '10px',
    md: '20px',
    lg: '30px',
    xl: '40px'
  },
  borderRadius: '8px',
  boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
  transition: 'all 0.3s ease'
}

export const Section = ({
  children,
  title,
  style,
  ...props
}: HTMLAttributes<HTMLElement>) => (
  <section
    style={{
      backgroundColor: theme.colors.white,
      padding: theme.spacing.xl,
      borderRadius: theme.borderRadius,
      boxShadow: theme.boxShadow,
      marginBottom: theme.spacing.lg,
      ...style
    }}
    {...props}
  >
    {title && (
      <h2 style={{ color: theme.colors.text, marginBottom: theme.spacing.md }}>
        {title}
      </h2>
    )}
    {children}
  </section>
)

export const Button = ({
  children,
  style,
  ...props
}: HTMLAttributes<HTMLElement>) => (
  <button
    {...props}
    style={{
      backgroundColor: theme.colors.primary,
      color: theme.colors.white,
      padding: '10px 20px',
      border: 'none',
      borderRadius: theme.borderRadius,
      cursor: 'pointer',
      transition: theme.transition,
      fontWeight: 500,
      ...style
    }}
    {...props}
  >
    {children}
  </button>
)

export const Input = ({
  label,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string }) => (
  <div style={{ marginBottom: theme.spacing.sm }}>
    {label && (
      <label style={{ display: 'block', marginBottom: '5px', fontWeight: 500 }}>
        {label}
      </label>
    )}
    <input
      {...props}
      style={{
        width: '100%',
        padding: '8px 12px',
        borderRadius: theme.borderRadius,
        border: `1px solid ${theme.colors.border}`,
        transition: theme.transition,
        ...props?.style
      }}
    />
  </div>
)
