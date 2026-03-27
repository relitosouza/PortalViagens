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
import { apiClient } from '@/lib/services/api.client';
import { Button } from '@/mobile/src/components/Button';

const NovaSolicitacaoScreen = ({ navigation }: any) => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Step 1: Servidor
  const [nomeServidor, setNomeServidor] = useState('');

  // Step 2: Viagem
  const [destino, setDestino] = useState('');
  const [motivo, setMotivo] = useState('');
  const [dataIda, setDataIda] = useState('');
  const [dataVolta, setDataVolta] = useState('');

  // Step 3: Logística
  const [passagem, setPassagem] = useState('');
  const [hospedagem, setHospedagem] = useState('');
  const [outrasDespesas, setOutrasDespesas] = useState('');

  // Step 4: Review
  const [notes, setNotes] = useState('');

  const handleNext = () => {
    if (validateStep()) {
      setStep(step + 1);
    }
  };

  const validateStep = () => {
    if (step === 1 && !nomeServidor.trim()) {
      Alert.alert('Erro', 'Informe o nome do servidor');
      return false;
    }
    if (
      step === 2 &&
      (!destino.trim() || !motivo.trim() || !dataIda.trim() || !dataVolta.trim())
    ) {
      Alert.alert('Erro', 'Preencha todos os campos');
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const newSolicitacao = {
        usuario: nomeServidor,
        destino,
        motivo,
        dataIda,
        dataVolta,
        passagem: parseFloat(passagem) || 0,
        hospedagem: parseFloat(hospedagem) || 0,
        outrasDespesas: parseFloat(outrasDespesas) || 0,
        notas: notes,
      };

      await apiClient.createSolicitacao(newSolicitacao);
      Alert.alert('Sucesso', 'Solicitação criada com sucesso!');
      navigation.goBack();
    } catch (error) {
      Alert.alert('Erro', 'Falha ao criar solicitação');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Progress Bar */}
      <View style={styles.progressBar}>
        {[1, 2, 3, 4].map((s) => (
          <View
            key={s}
            style={[
              styles.progressDot,
              step >= s && styles.progressDotActive,
            ]}
          />
        ))}
      </View>

      <ScrollView style={styles.content}>
        {/* Step 1: Servidor */}
        {step === 1 && (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>1. Dados do Servidor</Text>

            <Label text="Nome Completo" />
            <TextInput
              style={styles.input}
              placeholder="Seu nome"
              value={nomeServidor}
              onChangeText={setNomeServidor}
            />

            <Label text="CPF" />
            <TextInput
              style={styles.input}
              placeholder="000.000.000-00"
              editable={false}
              value="(Vinculado da conta)"
            />

            <Label text="Secretaria" />
            <TextInput
              style={styles.input}
              placeholder="Sua secretaria"
              editable={false}
              value="(Vinculado da conta)"
            />
          </View>
        )}

        {/* Step 2: Viagem */}
        {step === 2 && (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>2. Dados da Viagem</Text>

            <Label text="Destino" />
            <TextInput
              style={styles.input}
              placeholder="Cidade/Estado"
              value={destino}
              onChangeText={setDestino}
            />

            <Label text="Motivo da Viagem" />
            <TextInput
              style={styles.textArea}
              placeholder="Descreva o motivo..."
              value={motivo}
              onChangeText={setMotivo}
              multiline
              numberOfLines={3}
            />

            <Label text="Data de Ida" />
            <TextInput
              style={styles.input}
              placeholder="DD/MM/YYYY"
              value={dataIda}
              onChangeText={setDataIda}
            />

            <Label text="Data de Volta" />
            <TextInput
              style={styles.input}
              placeholder="DD/MM/YYYY"
              value={dataVolta}
              onChangeText={setDataVolta}
            />
          </View>
        )}

        {/* Step 3: Logística */}
        {step === 3 && (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>3. Despesas</Text>

            <Label text="Passagem (R$)" />
            <TextInput
              style={styles.input}
              placeholder="0,00"
              value={passagem}
              onChangeText={setPassagem}
              keyboardType="decimal-pad"
            />

            <Label text="Hospedagem (R$)" />
            <TextInput
              style={styles.input}
              placeholder="0,00"
              value={hospedagem}
              onChangeText={setHospedagem}
              keyboardType="decimal-pad"
            />

            <Label text="Outras Despesas (R$)" />
            <TextInput
              style={styles.input}
              placeholder="0,00"
              value={outrasDespesas}
              onChangeText={setOutrasDespesas}
              keyboardType="decimal-pad"
            />

            <View style={styles.totalBox}>
              <Text style={styles.totalLabel}>Total Estimado:</Text>
              <Text style={styles.totalValue}>
                R${' '}
                {(
                  (parseFloat(passagem) || 0) +
                  (parseFloat(hospedagem) || 0) +
                  (parseFloat(outrasDespesas) || 0)
                ).toFixed(2)}
              </Text>
            </View>
          </View>
        )}

        {/* Step 4: Review */}
        {step === 4 && (
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>4. Revisão</Text>

            <ReviewItem label="Servidor" value={nomeServidor} />
            <ReviewItem label="Destino" value={destino} />
            <ReviewItem label="Motivo" value={motivo} />
            <ReviewItem label="Período" value={`${dataIda} a ${dataVolta}`} />
            <ReviewItem
              label="Total"
              value={`R$ ${(
                (parseFloat(passagem) || 0) +
                (parseFloat(hospedagem) || 0) +
                (parseFloat(outrasDespesas) || 0)
              ).toFixed(2)}`}
            />

            <Label text="Observações Adicionais" />
            <TextInput
              style={styles.textArea}
              placeholder="(Opcional)"
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={3}
            />

            <Text style={styles.helper}>
              Ao enviar, a solicitação será encaminhada para aprovação de acordo com as regras
              de negócio.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Buttons */}
      <View style={styles.buttonContainer}>
        {step > 1 && (
          <Button
            label="← Voltar"
            onPress={() => setStep(step - 1)}
            variant="secondary"
            style={{ flex: 1, marginRight: 8 }}
          />
        )}

        {step < 4 ? (
          <Button
            label="Próximo →"
            onPress={handleNext}
            variant="primary"
            style={{ flex: 1 }}
          />
        ) : (
          <Button
            label={loading ? 'Enviando...' : 'Enviar Solicitação'}
            onPress={handleSubmit}
            variant="success"
            loading={loading}
            disabled={loading}
            style={{ flex: 1 }}
          />
        )}
      </View>
    </View>
  );
};

const Label = ({ text }: { text: string }) => (
  <Text style={styles.label}>{text}</Text>
);

const ReviewItem = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.reviewItem}>
    <Text style={styles.reviewLabel}>{label}</Text>
    <Text style={styles.reviewValue}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  progressBar: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  progressDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#ddd',
    marginHorizontal: 8,
  },
  progressDotActive: {
    backgroundColor: '#3366cc',
  },
  content: {
    flex: 1,
  },
  stepContainer: {
    padding: 16,
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
  },
  textArea: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#333',
    textAlignVertical: 'top',
  },
  totalBox: {
    backgroundColor: '#e3f2fd',
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3366cc',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#3366cc',
  },
  reviewItem: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#3366cc',
  },
  reviewLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  reviewValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  helper: {
    fontSize: 12,
    color: '#999',
    marginTop: 16,
    lineHeight: 18,
  },
  buttonContainer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
});

export default NovaSolicitacaoScreen;
