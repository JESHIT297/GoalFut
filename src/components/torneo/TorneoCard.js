import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, TOURNAMENT_STATUS_LABELS } from '../../utils/constants';
import { formatDate } from '../../utils/helpers';

const TorneoCard = ({ torneo, onPress }) => {
    const getStatusColor = () => {
        switch (torneo.estado) {
            case 'activo':
                return COLORS.success;
            case 'inscripcion':
                return COLORS.warning;
            case 'finalizado':
                return COLORS.textSecondary;
            default:
                return COLORS.textLight;
        }
    };

    const equiposCount = torneo.equipos?.[0]?.count || torneo.equipos?.length || 0;

    return (
        <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
            <View style={styles.header}>
                {torneo.imagen_url ? (
                    <Image source={{ uri: torneo.imagen_url }} style={styles.logo} />
                ) : (
                    <View style={[styles.logoPlaceholder, { backgroundColor: COLORS.primary }]}>
                        <Ionicons name="trophy" size={24} color={COLORS.textOnPrimary} />
                    </View>
                )}
                <View style={styles.info}>
                    <Text style={styles.nombre} numberOfLines={2}>{torneo.nombre}</Text>
                    <View style={styles.statusContainer}>
                        <View style={[styles.statusDot, { backgroundColor: getStatusColor() }]} />
                        <Text style={styles.statusText}>
                            {TOURNAMENT_STATUS_LABELS[torneo.estado] || torneo.estado}
                        </Text>
                    </View>
                </View>
            </View>

            {torneo.descripcion && (
                <Text style={styles.descripcion} numberOfLines={2}>
                    {torneo.descripcion}
                </Text>
            )}

            <View style={styles.footer}>
                <View style={styles.stat}>
                    <Ionicons name="people" size={16} color={COLORS.textSecondary} />
                    <Text style={styles.statText}>{equiposCount} equipos</Text>
                </View>

                {torneo.fecha_inicio && (
                    <View style={styles.stat}>
                        <Ionicons name="calendar" size={16} color={COLORS.textSecondary} />
                        <Text style={styles.statText}>{formatDate(torneo.fecha_inicio)}</Text>
                    </View>
                )}

                {torneo.lugar && (
                    <View style={styles.stat}>
                        <Ionicons name="location" size={16} color={COLORS.textSecondary} />
                        <Text style={styles.statText} numberOfLines={1}>{torneo.lugar}</Text>
                    </View>
                )}
            </View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    card: {
        backgroundColor: COLORS.surface,
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    logo: {
        width: 50,
        height: 50,
        borderRadius: 25,
    },
    logoPlaceholder: {
        width: 50,
        height: 50,
        borderRadius: 25,
        justifyContent: 'center',
        alignItems: 'center',
    },
    info: {
        flex: 1,
        marginLeft: 12,
    },
    nombre: {
        fontSize: 18,
        fontWeight: '700',
        color: COLORS.textPrimary,
    },
    statusContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 4,
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: 6,
    },
    statusText: {
        fontSize: 13,
        color: COLORS.textSecondary,
    },
    descripcion: {
        fontSize: 14,
        color: COLORS.textSecondary,
        marginTop: 12,
        lineHeight: 20,
    },
    footer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: COLORS.divider,
    },
    stat: {
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: 16,
        marginBottom: 4,
    },
    statText: {
        fontSize: 13,
        color: COLORS.textSecondary,
        marginLeft: 4,
    },
});

export default TorneoCard;
