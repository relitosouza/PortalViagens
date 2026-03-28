import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ActivityIndicator, View } from 'react-native';

import { useAuthStore } from '@/mobile/src/stores/authStore';
import LoginScreen from '@/mobile/src/screens/LoginScreen';
import DashboardScreen from '@/mobile/src/screens/DashboardScreen';
import FilasScreen from '@/mobile/src/screens/FilasScreen';
import PrestacaoScreen from '@/mobile/src/screens/PrestacaoScreen';
import PerfilScreen from '@/mobile/src/screens/PerfilScreen';
import SolicitacaoDetailScreen from '@/mobile/src/screens/SolicitacaoDetailScreen';
import NovaSolicitacaoScreen from '@/mobile/src/screens/NovasolicitacaoScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const AuthNavigator = () => (
  <Stack.Navigator
    screenOptions={{
      headerShown: false,
      animationEnabled: false,
    }}
  >
    <Stack.Screen name="Login" component={LoginScreen} />
  </Stack.Navigator>
);

const DashboardNavigator = () => {
  const { user } = useAuthStore();

  return (
    <Stack.Navigator>
      {/* Tab Navigator */}
      <Stack.Screen
        name="MainTabs"
        options={{ headerShown: false }}
      >
        {() => (
          <Tab.Navigator
            screenOptions={({ route }) => ({
              headerShown: true,
              tabBarIcon: ({ focused, color, size }) => {
                let iconName = 'home';
                if (route.name === 'Dashboard') iconName = 'home';
                else if (route.name === 'Filas') iconName = 'clipboard-check';
                else if (route.name === 'Prestacoes') iconName = 'file-document';
                else if (route.name === 'Perfil') iconName = 'account';

                return (
                  <MaterialCommunityIcons
                    name={iconName as any}
                    size={size}
                    color={color}
                  />
                );
              },
              tabBarActiveTintColor: '#3366cc',
              tabBarInactiveTintColor: '#999',
              headerStyle: { backgroundColor: '#3366cc' },
              headerTintColor: '#fff',
              headerTitleStyle: { fontWeight: 'bold' },
            })}
          >
            <Tab.Screen
              name="Dashboard"
              component={DashboardScreen}
              options={{ title: 'Meus Pedidos' }}
            />

            {/* Mostrar Filas só para SECOL, SEGOV, SF */}
            {user?.role !== 'DEMANDANTE' && (
              <Tab.Screen
                name="Filas"
                component={FilasScreen}
                options={{ title: 'Fila de Aprovação' }}
              />
            )}

            <Tab.Screen
              name="Prestacoes"
              component={PrestacaoScreen}
              options={{ title: 'Prestações' }}
            />

            <Tab.Screen
              name="Perfil"
              component={PerfilScreen}
              options={{ title: 'Perfil' }}
            />
          </Tab.Navigator>
        )}
      </Stack.Screen>

      {/* Detail Screens (Modal style) */}
      <Stack.Group screenOptions={{ presentation: 'modal' }}>
        <Stack.Screen
          name="SolicitacaoDetail"
          component={SolicitacaoDetailScreen}
          options={{ title: 'Detalhes da Solicitação', headerBackTitle: 'Voltar' }}
        />

        <Stack.Screen
          name="NovaSolicitacao"
          component={NovaSolicitacaoScreen}
          options={{ title: 'Nova Solicitação', headerBackTitle: 'Cancelar' }}
        />
      </Stack.Group>
    </Stack.Navigator>
  );
};

export const RootNavigator = () => {
  const { isAuthenticated, isLoading, hydrate } = useAuthStore();

  useEffect(() => {
    hydrate();
  }, []);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#3366cc" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {isAuthenticated ? <DashboardNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
};
