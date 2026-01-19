import React, { useEffect, useRef } from 'react';
import { StatusBar, Platform, View } from 'react-native';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/contexts/AuthContext';
import { OfflineProvider } from './src/contexts/OfflineContext';
import AppNavigator from './src/navigation/AppNavigator';
import notificationService from './src/services/notificationService';

export default function App() {
  const notificationListener = useRef();
  const responseListener = useRef();

  useEffect(() => {
    // Escuchar notificaciones recibidas
    notificationListener.current = notificationService.addNotificationReceivedListener(
      notification => {
        console.log('Notificación recibida:', notification);
      }
    );

    // Escuchar cuando el usuario toca la notificación
    responseListener.current = notificationService.addNotificationResponseListener(
      response => {
        console.log('Respuesta a notificación:', response);
        // Aquí puedes navegar a una pantalla específica según la notificación
      }
    );

    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, []);

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <OfflineProvider>
          {Platform.OS === 'android' && (
            <StatusBar
              backgroundColor="transparent"
              translucent={false}
              barStyle="dark-content"
            />
          )}
          <ExpoStatusBar style="dark" />
          <AppNavigator />
        </OfflineProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
