import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ActivityIndicator, View } from 'react-native';

import { useAuthStore } from '@/mobile/src/stores/authStore';
import LoginScreen from '@/mobile/src/screens/LoginScreen';
import DashboardScreen from '@/mobile/src/screens/DashboardScreen';

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

const DashboardNavigator = () => (
  <Tab.Navigator
    screenOptions={({ route }) => ({
      headerShown: true,
      tabBarIcon: ({ focused, color, size }) => {
        let iconName = 'home';
        if (route.name === 'Dashboard') iconName = 'home';
        else if (route.name === 'Solicitacoes') iconName = 'airplane';
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
      options={{ title: 'Dashboard' }}
    />
    <Tab.Screen
      name="Solicitacoes"
      component={DashboardScreen}
      options={{ title: 'Solicitações' }}
    />
    <Tab.Screen
      name="Prestacoes"
      component={DashboardScreen}
      options={{ title: 'Prestações' }}
    />
    <Tab.Screen
      name="Perfil"
      component={DashboardScreen}
      options={{ title: 'Perfil' }}
    />
  </Tab.Navigator>
);

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
