import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, RefreshControl } from 'react-native';
import { useAuthStore } from '@/mobile/src/stores/authStore';
import { apiClient } from '@/lib/services/api.client';
import { Button } from '@/mobile/src/components/Button';

interface Solicitacao {
  id: string;
  numero: string;
  titulo?: string;
  status: string;
  dataIda: string;
  dataVolta?: string;
  createdAt?: string;
}

const DashboardScreen = () => {
  const { user, token } = useAuthStore();
  const [solicitacoes, setSolicitacoes] = useState<Solicitacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (token) {
      apiClient.setToken(token);
    }
    loadSolicitacoes();
  }, [token]);

  const loadSolicitacoes = async () => {
    try {
      setLoading(true);
      const data = await apiClient.getSolicitacoes();
      setSolicitacoes(data);
    } catch (error) {
      console.error('Erro ao carregar solicitações:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadSolicitacoes();
    setRefreshing(false);
  };

  const getStatusColor = (status: string) => {
    if (status.includes('APROVADO') || status.includes('APROVACAO')) return styles.approved;
    if (status.includes('PENDENTE') || status.includes('AGUARDANDO')) return styles.pending;
    if (status.includes('REJEITADO') || status.includes('RECUSADO')) return styles.rejected;
    return styles.pending;
  };

  const renderItem = ({ item }: { item: Solicitacao }) => (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{item.numero}</Text>
      <Text style={styles.cardDate}>
        {item.dataIda ? new Date(item.dataIda).toLocaleDateString('pt-BR') : 'Data não definida'}
      </Text>
      <View style={[styles.statusBadge, getStatusColor(item.status)]}>
        <Text style={styles.statusText}>{item.status}</Text>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color="#3366cc" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.greeting}>Olá, {user?.name}! 👋</Text>
        <Text style={styles.role}>Perfil: {user?.role}</Text>
      </View>

      <FlatList
        data={solicitacoes}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Nenhuma solicitação encontrada</Text>
            <Button label="Criar Solicitação" onPress={() => {}} />
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
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
  emptyState: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginBottom: 16,
  },
});

export default DashboardScreen;
