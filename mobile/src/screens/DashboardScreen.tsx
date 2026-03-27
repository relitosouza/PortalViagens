import React from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';
import { useAuthStore } from '@/mobile/src/stores/authStore';

const DashboardScreen = () => {
  const { user } = useAuthStore();

  const mockSolicitacoes = [
    { id: '1', titulo: 'Viagem - São Paulo', status: 'Aprovado', data: '2026-03-20' },
    { id: '2', titulo: 'Viagem - Rio de Janeiro', status: 'Pendente', data: '2026-03-25' },
    { id: '3', titulo: 'Viagem - Brasília', status: 'Rejeitado', data: '2026-03-15' },
  ];

  const renderItem = ({ item }: any) => (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{item.titulo}</Text>
      <Text style={styles.cardDate}>{item.data}</Text>
      <View
        style={[
          styles.statusBadge,
          item.status === 'Aprovado' && styles.approved,
          item.status === 'Pendente' && styles.pending,
          item.status === 'Rejeitado' && styles.rejected,
        ]}
      >
        <Text style={styles.statusText}>{item.status}</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.greeting}>Olá, {user?.name}! 👋</Text>
        <Text style={styles.role}>Perfil: {user?.role}</Text>
      </View>

      <FlatList
        data={mockSolicitacoes}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#3366cc',
    padding: 20,
    paddingTop: 0,
  },
  greeting: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  role: {
    fontSize: 14,
    color: '#e0e0e0',
  },
  list: {
    padding: 16,
    paddingBottom: 32,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  cardDate: {
    fontSize: 12,
    color: '#999',
    marginBottom: 8,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  approved: {
    backgroundColor: '#e8f5e9',
  },
  pending: {
    backgroundColor: '#fff3e0',
  },
  rejected: {
    backgroundColor: '#ffebee',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
});

export default DashboardScreen;
