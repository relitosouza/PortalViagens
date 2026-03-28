import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { useAuthStore } from '@/mobile/src/stores/authStore';
import { apiClient } from '@/lib/services/api.client';
import { Button } from '@/mobile/src/components/Button';

interface Solicitacao {
  id: string;
  numero: string;
  status: string;
  dataIda: string;
  usuario: string;
}

const FilasScreen = ({ navigation }: any) => {
  const { user, token } = useAuthStore();
  const [solicitacoes, setSolicitacoes] = useState<Solicitacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (token) apiClient.setToken(token);
    loadFila();
  }, [token]);

  const loadFila = async () => {
    try {
      setLoading(true);
      const data = await apiClient.getSolicitacoes();

      // Filtrar por status baseado no role
      let filtered = data;
      if (user?.role === 'SECOL') {
        filtered = data.filter((s: any) => s.status.includes('AGUARDANDO_COTACAO'));
      } else if (user?.role === 'SEGOV') {
        filtered = data.filter((s: any) => s.status.includes('AGUARDANDO_VIABILIDADE'));
      } else if (user?.role === 'SF') {
        filtered = data.filter((s: any) => s.status.includes('AGUARDANDO_EXECUCAO'));
      }

      setSolicitacoes(filtered);
    } catch (error) {
      Alert.alert('Erro', 'Falha ao carregar fila');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadFila();
    setRefreshing(false);
  };

  const handleApprove = async (id: string) => {
    try {
      await apiClient.approveSolicitacao(id);
      Alert.alert('Sucesso', 'Solicitação aprovada');
      loadFila();
    } catch (error) {
      Alert.alert('Erro', 'Falha ao aprovar solicitação');
    }
  };

  const handleReject = async (id: string) => {
    Alert.prompt(
      'Motivo da Rejeição',
      'Informe o motivo:',
      [
        { text: 'Cancelar', onPress: () => {}, style: 'cancel' },
        {
          text: 'Rejeitar',
          onPress: async (reason) => {
            try {
              await apiClient.rejectSolicitacao(id, reason || '');
              Alert.alert('Sucesso', 'Solicitação rejeitada');
              loadFila();
            } catch (error) {
              Alert.alert('Erro', 'Falha ao rejeitar solicitação');
            }
          },
        },
      ],
      'plain-text'
    );
  };

  const renderItem = ({ item }: { item: Solicitacao }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{item.numero}</Text>
        <Text style={styles.cardSubtitle}>{item.usuario}</Text>
      </View>

      <Text style={styles.cardDate}>
        {new Date(item.dataIda).toLocaleDateString('pt-BR')}
      </Text>

      <View style={styles.actions}>
        <Button
          label="✓ Aprovar"
          onPress={() => handleApprove(item.id)}
          variant="success"
          size="sm"
          style={{ flex: 1, marginRight: 8 }}
        />
        <Button
          label="✗ Rejeitar"
          onPress={() => handleReject(item.id)}
          variant="danger"
          size="sm"
          style={{ flex: 1 }}
        />
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
        <Text style={styles.headerTitle}>Fila de Aprovação</Text>
        <Text style={styles.headerSubtitle}>
          {solicitacoes.length} item(ns) aguardando
        </Text>
      </View>

      <FlatList
        data={solicitacoes}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Nenhuma solicitação na fila</Text>
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
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  headerSubtitle: {
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
  cardHeader: {
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  cardSubtitle: {
    fontSize: 12,
    color: '#666',
  },
  cardDate: {
    fontSize: 12,
    color: '#999',
    marginBottom: 12,
  },
  actions: {
    flexDirection: 'row',
  },
  emptyState: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
  },
});

export default FilasScreen;
