import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, MATCH_STATUS, MATCH_STATUS_LABELS } from '../../utils/constants';
import { formatDate, formatTime, formatTimer } from '../../utils/helpers';

const PartidoCard = ({ partido, onPress, showTorneo = false }) => {
    const isLive = partido.estado === MATCH_STATUS.EN_JUEGO || partido.estado === MATCH_STATUS.PAUSADO;
    const isFinished = partido.estado === MATCH_STATUS.FINALIZADO;

    const getStatusColor = () => {
        switch (partido.estado) {
            case MATCH_STATUS.EN_JUEGO:
                return COLORS.matchLive;
            case MATCH_STATUS.FINALIZADO:
                return COLORS.matchFinished;
            case MATCH_STATUS.PAUSADO:
            case MATCH_STATUS.MEDIO_TIEMPO:
                return COLORS.warning;
            default:
                return COLORS.textSecondary;
        }
    };

    const renderTeam = (equipo, goles, isLeft = true) => (
        <View style={[styles.team, isLeft ? styles.teamLeft : styles.teamRight]}>
            {equipo?.logo_url ? (
                <Image source={{ uri: equipo.logo_url }} style={styles.teamLogo} />
            ) : (
                <View style={[styles.teamLogoPlaceholder, { backgroundColor: COLORS.primaryLight }]}>
                    <Ionicons name="shield" size={20} color={COLORS.textOnPrimary} />
                </View>
            )}
            <Text style={styles.teamName} numberOfLines={2}>
                {equipo?.nombre_corto || equipo?.nombre || 'Equipo'}
            </Text>
            {(isLive || isFinished) && (
                <Text style={styles.score}>{goles}</Text>
            )}
        </View>
    );

    return (
        <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
            {showTorneo && partido.torneo && (
                <Text style={styles.torneoName}>{partido.torneo.nombre}</Text>
            )}

            <View style={styles.matchInfo}>
                {/* Equipo Local */}
                {renderTeam(partido.equipo_local, partido.goles_local, true)}

                {/* Centro - Hora o VS */}
                <View style={styles.center}>
                    {isLive && (
                        <View style={[styles.liveIndicator, { backgroundColor: getStatusColor() }]}>
                            <Text style={styles.liveText}>
                                {MATCH_STATUS_LABELS[partido.estado]}
                            </Text>
                        </View>
                    )}

                    {isLive && (
                        <Text style={styles.timer}>
                            {formatTimer(partido.segundos_jugados || 0)}
                        </Text>
                    )}

                    {!isLive && !isFinished && (
                        <>
                            <Text style={styles.vs}>VS</Text>
                            <Text style={styles.time}>
                                {partido.hora ? formatTime(partido.hora) : '--:--'}
                            </Text>
                        </>
                    )}

                    {isFinished && (
                        <View style={styles.finalIndicator}>
                            <Text style={styles.finalText}>FINAL</Text>
                        </View>
                    )}
                </View>

                {/* Equipo Visitante */}
                {renderTeam(partido.equipo_visitante, partido.goles_visitante, false)}
            </View>

            {/* Footer con fecha y cancha */}
            <View style={styles.footer}>
                {partido.fecha && (
                    <View style={styles.footerItem}>
                        <Ionicons name="calendar-outline" size={14} color={COLORS.textSecondary} />
                        <Text style={styles.footerText}>{formatDate(partido.fecha)}</Text>
                    </View>
                )}

                {partido.jornada && (
                    <View style={styles.footerItem}>
                        <Text style={styles.footerText}>Jornada {partido.jornada}</Text>
                    </View>
                )}

                {partido.cancha && (
                    <View style={styles.footerItem}>
                        <Ionicons name="location-outline" size={14} color={COLORS.textSecondary} />
                        <Text style={styles.footerText}>{partido.cancha}</Text>
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
    torneoName: {
        fontSize: 12,
        color: COLORS.textSecondary,
        marginBottom: 12,
        textAlign: 'center',
    },
    matchInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    team: {
        flex: 1,
        alignItems: 'center',
    },
    teamLeft: {
        alignItems: 'center',
    },
    teamRight: {
        alignItems: 'center',
    },
    teamLogo: {
        width: 48,
        height: 48,
        borderRadius: 24,
    },
    teamLogoPlaceholder: {
        width: 48,
        height: 48,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
    },
    teamName: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.textPrimary,
        marginTop: 8,
        textAlign: 'center',
    },
    score: {
        fontSize: 28,
        fontWeight: '700',
        color: COLORS.textPrimary,
        marginTop: 4,
    },
    center: {
        alignItems: 'center',
        paddingHorizontal: 12,
        minWidth: 70,
    },
    vs: {
        fontSize: 16,
        fontWeight: '700',
        color: COLORS.textSecondary,
    },
    time: {
        fontSize: 14,
        color: COLORS.textSecondary,
        marginTop: 4,
    },
    liveIndicator: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    liveText: {
        fontSize: 11,
        fontWeight: '700',
        color: COLORS.textOnPrimary,
        textTransform: 'uppercase',
    },
    timer: {
        fontSize: 18,
        fontWeight: '700',
        color: COLORS.textPrimary,
        marginTop: 4,
    },
    finalIndicator: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        backgroundColor: COLORS.surfaceVariant,
    },
    finalText: {
        fontSize: 11,
        fontWeight: '700',
        color: COLORS.textSecondary,
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: COLORS.divider,
        flexWrap: 'wrap',
    },
    footerItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: 8,
    },
    footerText: {
        fontSize: 12,
        color: COLORS.textSecondary,
        marginLeft: 4,
    },
});

export default PartidoCard;
