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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { Button, Input } from '../../components/common';
import { COLORS } from '../../utils/constants';
import { isValidEmail } from '../../utils/helpers';
import { getErrorMessage } from '../../utils/errorHandler';

const RegisterScreen = ({ navigation }) => {
    const { signUp, loading } = useAuth();
    const [formData, setFormData] = useState({
        nombre: '',
        email: '',
        telefono: '',
        password: '',
        confirmPassword: '',
    });
    const [errors, setErrors] = useState({});
    const [showPassword, setShowPassword] = useState(false);

    const updateField = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        if (errors[field]) {
            setErrors(prev => ({ ...prev, [field]: null }));
        }
    };

    const validate = () => {
        const newErrors = {};

        if (!formData.nombre.trim()) {
            newErrors.nombre = 'El nombre es requerido';
        } else if (formData.nombre.trim().length < 3) {
            newErrors.nombre = 'Mínimo 3 caracteres';
        }

        if (!formData.email.trim()) {
            newErrors.email = 'El email es requerido';
        } else if (!isValidEmail(formData.email)) {
            newErrors.email = 'Email inválido';
        }

        if (!formData.password) {
            newErrors.password = 'La contraseña es requerida';
        } else if (formData.password.length < 6) {
            newErrors.password = 'Mínimo 6 caracteres';
        }

        if (formData.password !== formData.confirmPassword) {
            newErrors.confirmPassword = 'Las contraseñas no coinciden';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleRegister = async () => {
        if (!validate()) return;

        const result = await signUp(
            formData.email.trim().toLowerCase(),
            formData.password,
            formData.nombre.trim(),
            formData.telefono.trim() || null
        );

        if (!result.success) {
            setErrors({ general: getErrorMessage(result.error) });
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
                    {/* Header */}
                    <View style={styles.header}>
                        <TouchableOpacity
                            style={styles.backButton}
                            onPress={() => navigation.goBack()}
                        >
                            <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
                        </TouchableOpacity>
                        <Text style={styles.title}>Crear Cuenta</Text>
                        <Text style={styles.subtitle}>
                            Únete a GoalFut y gestiona tus torneos
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
                            label="Nombre completo"
                            value={formData.nombre}
                            onChangeText={(v) => updateField('nombre', v)}
                            placeholder="Tu nombre"
                            error={errors.nombre}
                            icon={<Ionicons name="person-outline" size={20} color={COLORS.textSecondary} />}
                        />

                        <Input
                            label="Correo electrónico"
                            value={formData.email}
                            onChangeText={(v) => updateField('email', v)}
                            placeholder="correo@ejemplo.com"
                            keyboardType="email-address"
                            error={errors.email}
                            icon={<Ionicons name="mail-outline" size={20} color={COLORS.textSecondary} />}
                        />

                        <Input
                            label="Teléfono (opcional)"
                            value={formData.telefono}
                            onChangeText={(v) => updateField('telefono', v)}
                            placeholder="+57 300 123 4567"
                            keyboardType="phone-pad"
                            error={errors.telefono}
                            icon={<Ionicons name="call-outline" size={20} color={COLORS.textSecondary} />}
                        />

                        <View>
                            <Input
                                label="Contraseña"
                                value={formData.password}
                                onChangeText={(v) => updateField('password', v)}
                                placeholder="Mínimo 6 caracteres"
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

                        <Input
                            label="Confirmar contraseña"
                            value={formData.confirmPassword}
                            onChangeText={(v) => updateField('confirmPassword', v)}
                            placeholder="Repite tu contraseña"
                            secureTextEntry={!showPassword}
                            error={errors.confirmPassword}
                            icon={<Ionicons name="lock-closed-outline" size={20} color={COLORS.textSecondary} />}
                        />

                        <Button
                            title="Crear Cuenta"
                            onPress={handleRegister}
                            loading={loading}
                            style={styles.registerButton}
                        />
                    </View>

                    {/* Footer */}
                    <View style={styles.footer}>
                        <Text style={styles.footerText}>¿Ya tienes cuenta? </Text>
                        <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                            <Text style={styles.footerLink}>Inicia Sesión</Text>
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
    },
    header: {
        marginBottom: 32,
    },
    backButton: {
        marginBottom: 16,
    },
    title: {
        fontSize: 28,
        fontWeight: '700',
        color: COLORS.textPrimary,
    },
    subtitle: {
        fontSize: 16,
        color: COLORS.textSecondary,
        marginTop: 8,
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
    registerButton: {
        marginTop: 8,
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingBottom: 24,
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

export default RegisterScreen;
