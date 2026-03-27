import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from 'react-native';

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'success';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  fullWidth?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const Button: React.FC<ButtonProps> = ({
  label,
  onPress,
  onClick,
  variant = 'primary',
  disabled = false,
  loading = false,
  style,
  fullWidth = true,
  size = 'md',
}) => {
  const handlePress = onPress || onClick;

  const styles = StyleSheet.create({
    button: {
      paddingVertical: size === 'sm' ? 8 : size === 'md' ? 12 : 16,
      paddingHorizontal: size === 'sm' ? 10 : size === 'md' ? 14 : 20,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      width: fullWidth ? '100%' : 'auto',
      opacity: disabled || loading ? 0.6 : 1,
    },
    primary: { backgroundColor: '#3366cc' },
    secondary: { backgroundColor: '#e0e0e0' },
    danger: { backgroundColor: '#dc3545' },
    success: { backgroundColor: '#28a745' },
    text: {
      fontSize: size === 'sm' ? 12 : size === 'md' ? 14 : 16,
      fontWeight: '600',
      marginLeft: loading ? 8 : 0,
    },
    primaryText: { color: '#fff' },
    secondaryText: { color: '#333' },
    dangerText: { color: '#fff' },
    successText: { color: '#fff' },
  });

  const variantStyles: Record<string, any> = {
    primary: [styles.button, styles.primary],
    secondary: [styles.button, styles.secondary],
    danger: [styles.button, styles.danger],
    success: [styles.button, styles.success],
  };

  const textStyles: Record<string, any> = {
    primary: [styles.text, styles.primaryText],
    secondary: [styles.text, styles.secondaryText],
    danger: [styles.text, styles.dangerText],
    success: [styles.text, styles.successText],
  };

  return (
    <TouchableOpacity
      style={[variantStyles[variant], style]}
      onPress={handlePress}
      disabled={disabled || loading}
    >
      {loading && <ActivityIndicator color={variant === 'secondary' ? '#333' : '#fff'} />}
      <Text style={textStyles[variant]}>{label}</Text>
    </TouchableOpacity>
  );
};
