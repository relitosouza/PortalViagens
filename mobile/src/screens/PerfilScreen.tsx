import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useAuthStore } from '@/mobile/src/stores/authStore';
import { Button } from '@/mobile/src/components/Button';

const PerfilScreen = ({ navigation }: any) => {
  const { user, logout } = useAuthStore();

  const handleLogout = async () => {
    Alert.alert('Logout', 'Tem certeza que deseja sair?', [
      { text: 'Cancelar', onPress: () => {}, style: 'cancel' },
      {
        text: 'Sair',
        onPress: async () => {
          await logout();
        },
        style: 'destructive',
      },
    ]);
  };

  const menuItems = [
    { icon: '📋', label: 'Minhas Viagens', value: '5 solicitações' },
    { icon: '✅', label: 'Aprovadas', value: '3' },
    { icon: '⏳', label: 'Pendentes', value: '1' },
    { icon: '❌', label: 'Rejeitadas', value: '1' },
  ];

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {user?.name?.charAt(0).toUpperCase() || 'U'}
          </Text>
        </View>

        <Text style={styles.name}>{user?.name}</Text>
        <Text style={styles.email}>{user?.email}</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.roleSection}>
          <Text style={styles.roleLabel}>Perfil de Acesso</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>{user?.role}</Text>
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Estatísticas</Text>

        {menuItems.map((item, index) => (
          <TouchableOpacity key={index} style={styles.menuItem}>
            <Text style={styles.menuIcon}>{item.icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.menuLabel}>{item.label}</Text>
            </View>
            <Text style={styles.menuValue}>{item.value}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Informações</Text>

        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>ID do Usuário</Text>
          <Text style={styles.infoValue}>{user?.id}</Text>
        </View>

        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>Versão do App</Text>
          <Text style={styles.infoValue}>0.1.0</Text>
        </View>

        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>Ambiente</Text>
          <Text style={styles.infoValue}>Produção</Text>
        </View>
      </View>

      <View style={{ padding: 16, paddingBottom: 32 }}>
        <Button
          label="🚪 Sair (Logout)"
          onPress={handleLogout}
          variant="danger"
          fullWidth
        />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#3366cc',
    paddingVertical: 30,
    alignItems: 'center',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#3366cc',
  },
  name: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  email: {
    fontSize: 14,
    color: '#e0e0e0',
  },
  card: {
    backgroundColor: '#fff',
    margin: 16,
    marginBottom: 8,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  roleSection: {
    alignItems: 'center',
  },
  roleLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 8,
  },
  roleBadge: {
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  roleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3366cc',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  menuIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  menuLabel: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  menuValue: {
    fontSize: 14,
    color: '#3366cc',
    fontWeight: '600',
  },
  infoItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  infoLabel: {
    fontSize: 13,
    color: '#666',
  },
  infoValue: {
    fontSize: 13,
    color: '#333',
    fontWeight: '500',
  },
});

export default PerfilScreen;
