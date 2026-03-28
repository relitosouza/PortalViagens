import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { apiClient } from '@/lib/services/api.client';
import { Button } from '@/mobile/src/components/Button';
import { useAuthStore } from '@/mobile/src/stores/authStore';

interface WorkflowStep {
  status: string;
  date: string;
  approvedBy?: string;
  reason?: string;
}

interface Solicitacao {
  id: string;
  numero: string;
  status: string;
  dataIda: string;
  dataVolta: string;
  usuario: string;
  destino?: string;
  motivo?: string;
  valor?: number;
  documentos?: string[];
  workflow?: WorkflowStep[];
}

const SolicitacaoDetailScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { solicitacaoId } = route.params as { solicitacaoId: string };
  const { user, token } = useAuthStore();

  const [solicitacao, setSolicitacao] = useState<Solicitacao | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (token) apiClient.setToken(token);
    loadDetalhes();
  }, [token]);

  const loadDetalhes = async () => {
    try {
      setLoading(true);
      const data = await apiClient.getSolicitacao(solicitacaoId);
      setSolicitacao(data);
    } catch (error) {
      Alert.alert('Erro', 'Falha ao carregar detalhes');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    setActionLoading(true);
    try {
      await apiClient.approveSolicitacao(solicitacaoId);
      Alert.alert('Sucesso', 'Solicitação aprovada');
      loadDetalhes();
    } catch (error) {
      Alert.alert('Erro', 'Falha ao aprovar');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    Alert.prompt(
      'Motivo da Rejeição',
      'Informe o motivo:',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Rejeitar',
          onPress: async (reason) => {
            setActionLoading(true);
            try {
              await apiClient.rejectSolicitacao(solicitacaoId, reason || '');
              Alert.alert('Sucesso', 'Solicitação rejeitada');
              loadDetalhes();
            } catch (error) {
              Alert.alert('Erro', 'Falha ao rejeitar');
            } finally {
              setActionLoading(false);
            }
          },
          style: 'destructive',
        },
      ],
      'plain-text'
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color="#3366cc" />
      </View>
    );
  }

  if (!solicitacao) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Text>Solicitação não encontrada</Text>
      </View>
    );
  }

  const canApprove =
    user?.role !== 'DEMANDANTE' &&
    !solicitacao.status.includes('APROVADO') &&
    !solicitacao.status.includes('REJEITADO');

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.numero}>{solicitacao.numero}</Text>
        <View
          style={[
            styles.statusBadge,
            solicitacao.status.includes('APROVADO') && styles.approved,
            solicitacao.status.includes('REJEITADO') && styles.rejected,
          ]}
        >
          <Text style={styles.statusText}>{solicitacao.status}</Text>
        </View>
      </View>

      {/* Dados Principais */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Informações da Viagem</Text>

        <InfoRow label="Usuário" value={solicitacao.usuario} />
        <InfoRow
          label="Data Ida"
          value={new Date(solicitacao.dataIda).toLocaleDateString('pt-BR')}
        />
        <InfoRow
          label="Data Volta"
          value={new Date(solicitacao.dataVolta).toLocaleDateString('pt-BR')}
        />

        {solicitacao.destino && <InfoRow label="Destino" value={solicitacao.destino} />}
        {solicitacao.motivo && <InfoRow label="Motivo" value={solicitacao.motivo} />}
        {solicitacao.valor && (
          <InfoRow label="Valor" value={`R$ ${solicitacao.valor.toFixed(2)}`} />
        )}
      </View>

      {/* Timeline */}
      {solicitacao.workflow && solicitacao.workflow.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Timeline</Text>

          {solicitacao.workflow.map((step, index) => (
            <View key={index} style={styles.timelineItem}>
              <View style={styles.timelineDot} />
              <View style={{ flex: 1 }}>
                <Text style={styles.timelineStatus}>{step.status}</Text>
                <Text style={styles.timelineDate}>
                  {new Date(step.date).toLocaleDateString('pt-BR')}
                </Text>
                {step.approvedBy && (
                  <Text style={styles.timelineInfo}>Aprovado por: {step.approvedBy}</Text>
                )}
                {step.reason && (
                  <Text style={styles.timelineInfo}>Motivo: {step.reason}</Text>
                )}
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Documentos */}
      {solicitacao.documentos && solicitacao.documentos.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Documentos</Text>

          {solicitacao.documentos.map((doc, index) => (
            <View key={index} style={styles.docItem}>
              <Text style={styles.docIcon}>📄</Text>
              <Text style={styles.docName}>{doc}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Ações */}
      {canApprove && (
        <View style={styles.actionsCard}>
          <Button
            label="✓ Aprovar"
            onPress={handleApprove}
            variant="success"
            loading={actionLoading}
            disabled={actionLoading}
            fullWidth
          />

          <View style={{ height: 12 }} />

          <Button
            label="✗ Rejeitar"
            onPress={handleReject}
            variant="danger"
            loading={actionLoading}
            disabled={actionLoading}
            fullWidth
          />
        </View>
      )}

      <View style={{ height: 32 }} />
    </ScrollView>
  );
};

const InfoRow = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.infoRow}>
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={styles.infoValue}>{value}</Text>
  </View>
);

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
  numero: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#fff3e0',
  },
  approved: {
    backgroundColor: '#e8f5e9',
  },
  rejected: {
    backgroundColor: '#ffebee',
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
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
  actionsCard: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  infoLabel: {
    fontSize: 14,
    color: '#666',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#3366cc',
    marginRight: 12,
    marginTop: 4,
  },
  timelineStatus: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  timelineDate: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  timelineInfo: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
  docItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  docIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  docName: {
    flex: 1,
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
});

export default SolicitacaoDetailScreen;
