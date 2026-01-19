import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    TouchableOpacity,
    Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { Button, Input } from '../../components/common';
import { COLORS } from '../../utils/constants';
import { isValidEmail } from '../../utils/helpers';
import { getErrorMessage } from '../../utils/errorHandler';

const LoginScreen = ({ navigation }) => {
    const { signIn, continueAsGuest, loading } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [errors, setErrors] = useState({});
    const [showPassword, setShowPassword] = useState(false);

    const validate = () => {
        const newErrors = {};

        if (!email.trim()) {
            newErrors.email = 'El email es requerido';
        } else if (!isValidEmail(email)) {
            newErrors.email = 'Email inválido';
        }

        if (!password) {
            newErrors.password = 'La contraseña es requerida';
        } else if (password.length < 6) {
            newErrors.password = 'Mínimo 6 caracteres';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleLogin = async () => {
        if (!validate()) return;

        const result = await signIn(email.trim().toLowerCase(), password);

        if (!result.success) {
            setErrors({ general: getErrorMessage(result.error) });
        }
    };

    const handleGuest = async () => {
        console.log('Continuar como invitado presionado');
        await continueAsGuest();
        // Si ya estábamos en la app, volver atrás
        if (navigation.canGoBack()) {
            navigation.goBack();
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardView}
            >
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                >
                    {/* Logo y título */}
                    <View style={styles.header}>
                        <View style={styles.logoContainer}>
                            <Ionicons name="football" size={60} color={COLORS.primary} />
                        </View>
                        <Text style={styles.title}>GoalFut</Text>
                        <Text style={styles.subtitle}>
                            Gestión de torneos de fútbol de salón
                        </Text>
                    </View>

                    {/* Formulario */}
                    <View style={styles.form}>
                        {errors.general && (
                            <View style={styles.errorBox}>
                                <Ionicons name="alert-circle" size={20} color={COLORS.error} />
                                <Text style={styles.errorBoxText}>{errors.general}</Text>
                            </View>
                        )}

                        <Input
                            label="Correo electrónico"
                            value={email}
                            onChangeText={setEmail}
                            placeholder="correo@ejemplo.com"
                            keyboardType="email-address"
                            error={errors.email}
                            icon={<Ionicons name="mail-outline" size={20} color={COLORS.textSecondary} />}
                        />

                        <View>
                            <Input
                                label="Contraseña"
                                value={password}
                                onChangeText={setPassword}
                                placeholder="Tu contraseña"
                                secureTextEntry={!showPassword}
                                error={errors.password}
                                icon={<Ionicons name="lock-closed-outline" size={20} color={COLORS.textSecondary} />}
                            />
                            <TouchableOpacity
                                style={styles.showPasswordButton}
                                onPress={() => setShowPassword(!showPassword)}
                            >
                                <Ionicons
                                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                                    size={20}
                                    color={COLORS.textSecondary}
                                />
                            </TouchableOpacity>
                        </View>

                        <Button
                            title="Iniciar Sesión"
                            onPress={handleLogin}
                            loading={loading}
                            style={styles.loginButton}
                        />

                        <View style={styles.divider}>
                            <View style={styles.dividerLine} />
                            <Text style={styles.dividerText}>o</Text>
                            <View style={styles.dividerLine} />
                        </View>

                        <Button
                            title="Continuar como Invitado"
                            onPress={handleGuest}
                            variant="outline"
                            icon={<Ionicons name="person-outline" size={20} color={COLORS.primary} />}
                        />
                    </View>

                    {/* Footer - Registro */}
                    <View style={styles.footer}>
                        <Text style={styles.footerText}>¿No tienes cuenta? </Text>
                        <TouchableOpacity onPress={() => navigation.navigate('Register')}>
                            <Text style={styles.footerLink}>Regístrate</Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    keyboardView: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        padding: 24,
        justifyContent: 'center',
    },
    header: {
        alignItems: 'center',
        marginBottom: 40,
    },
    logoContainer: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: COLORS.surface,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 5,
    },
    title: {
        fontSize: 32,
        fontWeight: '700',
        color: COLORS.textPrimary,
        marginTop: 16,
    },
    subtitle: {
        fontSize: 16,
        color: COLORS.textSecondary,
        marginTop: 8,
        textAlign: 'center',
    },
    form: {
        marginBottom: 24,
    },
    errorBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFEBEE',
        padding: 12,
        borderRadius: 8,
        marginBottom: 16,
    },
    errorBoxText: {
        color: COLORS.error,
        marginLeft: 8,
        flex: 1,
    },
    showPasswordButton: {
        position: 'absolute',
        right: 16,
        top: 42,
    },
    loginButton: {
        marginTop: 8,
    },
    divider: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 24,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: COLORS.border,
    },
    dividerText: {
        color: COLORS.textSecondary,
        paddingHorizontal: 16,
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
    },
    footerText: {
        color: COLORS.textSecondary,
        fontSize: 16,
    },
    footerLink: {
        color: COLORS.primary,
        fontSize: 16,
        fontWeight: '600',
    },
});

export default LoginScreen;
