import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../utils/constants';

const EmptyState = ({
    icon = 'folder-open-outline',
    title = 'Sin datos',
    message = 'No hay información disponible',
    actionText = null,
    onAction = null,
}) => {
    return (
        <View style={styles.container}>
            <Ionicons name={icon} size={64} color={COLORS.textLight} />
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.message}>{message}</Text>
            {actionText && onAction && (
                <TouchableOpacity style={styles.button} onPress={onAction}>
                    <Text style={styles.buttonText}>{actionText}</Text>
                </TouchableOpacity>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        color: COLORS.textPrimary,
        marginTop: 16,
        textAlign: 'center',
    },
    message: {
        fontSize: 16,
        color: COLORS.textSecondary,
        marginTop: 8,
        textAlign: 'center',
    },
    button: {
        marginTop: 24,
        paddingVertical: 12,
        paddingHorizontal: 24,
        backgroundColor: COLORS.primary,
        borderRadius: 12,
    },
    buttonText: {
        color: COLORS.textOnPrimary,
        fontSize: 16,
        fontWeight: '600',
    },
});

export default EmptyState;
