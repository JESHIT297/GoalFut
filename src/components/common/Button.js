import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { COLORS } from '../../utils/constants';

const Button = ({
    title,
    onPress,
    variant = 'primary', // primary, secondary, outline, danger
    size = 'medium', // small, medium, large
    disabled = false,
    loading = false,
    icon = null,
    style = {},
}) => {
    const getVariantStyles = () => {
        switch (variant) {
            case 'secondary':
                return {
                    backgroundColor: COLORS.secondary,
                    borderColor: COLORS.secondary,
                };
            case 'outline':
                return {
                    backgroundColor: 'transparent',
                    borderColor: COLORS.primary,
                    borderWidth: 2,
                };
            case 'danger':
                return {
                    backgroundColor: COLORS.error,
                    borderColor: COLORS.error,
                };
            default:
                return {
                    backgroundColor: COLORS.primary,
                    borderColor: COLORS.primary,
                };
        }
    };

    const getSizeStyles = () => {
        switch (size) {
            case 'small':
                return {
                    paddingVertical: 8,
                    paddingHorizontal: 16,
                };
            case 'large':
                return {
                    paddingVertical: 16,
                    paddingHorizontal: 32,
                };
            default:
                return {
                    paddingVertical: 12,
                    paddingHorizontal: 24,
                };
        }
    };

    const getTextColor = () => {
        if (variant === 'outline') {
            return COLORS.primary;
        }
        return COLORS.textOnPrimary;
    };

    const getTextSize = () => {
        switch (size) {
            case 'small':
                return 14;
            case 'large':
                return 18;
            default:
                return 16;
        }
    };

    return (
        <TouchableOpacity
            style={[
                styles.button,
                getVariantStyles(),
                getSizeStyles(),
                disabled && styles.disabled,
                style,
            ]}
            onPress={onPress}
            disabled={disabled || loading}
            activeOpacity={0.8}
        >
            {loading ? (
                <ActivityIndicator color={getTextColor()} size="small" />
            ) : (
                <>
                    {icon}
                    <Text
                        style={[
                            styles.text,
                            { color: getTextColor(), fontSize: getTextSize() },
                            icon && styles.textWithIcon,
                        ]}
                    >
                        {title}
                    </Text>
                </>
            )}
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    button: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 12,
        borderWidth: 1,
    },
    text: {
        fontWeight: '600',
        textAlign: 'center',
    },
    textWithIcon: {
        marginLeft: 8,
    },
    disabled: {
        opacity: 0.5,
    },
});

export default Button;
