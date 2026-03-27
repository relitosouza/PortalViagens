import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useAuthStore } from '@/mobile/src/stores/authStore';
import { Button } from '@/mobile/src/components/Button';

const PrestacaoScreen = () => {
  const { user } = useAuthStore();
  const [descricao, setDescricao] = useState('');
  const [loading, setLoading] = useState(false);
  const [hasPendingAccounts, setHasPendingAccounts] = useState(false);

  const handleSubmit = async () => {
    if (!descricao.trim()) {
      Alert.alert('Erro', 'Descreva a prestação de contas');
      return;
    }

    setLoading(true);
    try {
      // TODO: Integrar com API de prestação de contas
      // await apiClient.submitPrestacao({ descricao });
      Alert.alert('Sucesso', 'Prestação de contas enviada com sucesso!');
      setDescricao('');
    } catch (error) {
      Alert.alert('Erro', 'Falha ao enviar prestação de contas');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Prestação de Contas</Text>
      </View>

      {hasPendingAccounts && (
        <View style={styles.alertBox}>
          <Text style={styles.alertTitle}>⚠️ CPF Bloqueado</Text>
          <Text style={styles.alertText}>
            Você tem prestações de contas pendentes. Seu CPF está bloqueado para novas viagens.
          </Text>
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Enviar Nova Prestação</Text>

        <Text style={styles.label}>Descrição da Viagem</Text>
        <TextInput
          style={styles.textArea}
          placeholder="Descreva os gastos e documentos anexados..."
          value={descricao}
          onChangeText={setDescricao}
          multiline
          numberOfLines={6}
          editable={!loading}
        />

        <Text style={styles.helper}>
          Anexe recibos, notas fiscais e comprovantes de pagamento em formato PDF.
        </Text>

        <Button
          label={loading ? 'Enviando...' : 'Enviar Prestação'}
          onPress={handleSubmit}
          loading={loading}
          disabled={loading}
          fullWidth
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Histórico</Text>

        <View style={styles.historyItem}>
          <View style={styles.historyDot} />
          <View style={{ flex: 1 }}>
            <Text style={styles.historyTitle}>Prestação #001</Text>
            <Text style={styles.historyDate}>Enviada em 15/03/2026</Text>
            <View style={[styles.statusBadge, styles.approved]}>
              <Text style={styles.statusText}>Aprovada</Text>
            </View>
          </View>
        </View>
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
    padding: 20,
    paddingTop: 0,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  alertBox: {
    backgroundColor: '#fff3cd',
    borderLeftWidth: 4,
    borderLeftColor: '#ffc107',
    margin: 16,
    padding: 12,
    borderRadius: 8,
  },
  alertTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#856404',
    marginBottom: 4,
  },
  alertText: {
    fontSize: 12,
    color: '#856404',
    lineHeight: 18,
  },
  card: {
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
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  textArea: {
    backgroundColor: '#f9f9f9',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#333',
    marginBottom: 8,
    textAlignVertical: 'top',
  },
  helper: {
    fontSize: 12,
    color: '#999',
    marginBottom: 16,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  historyDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#3366cc',
    marginRight: 12,
    marginTop: 4,
  },
  historyTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  historyDate: {
    fontSize: 12,
    color: '#999',
    marginBottom: 6,
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
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2e7d32',
  },
});

export default PrestacaoScreen;
