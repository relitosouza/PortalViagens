import axios, { AxiosInstance } from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

interface LoginPayload {
  email: string;
  password: string;
}

interface AuthResponse {
  user: {
    id: string;
    email: string;
    role: 'DEMANDANTE' | 'SECOL' | 'SEGOV' | 'SF';
    name: string;
  };
  token?: string;
  refreshToken?: string;
}

interface Solicitacao {
  id: string;
  numero: string;
  titulo: string;
  status: string;
  dataIda: string;
  dataVolta: string;
  usuario: string;
  createdAt: string;
}

class ApiClient {
  private client: AxiosInstance;
  private token: string | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: API_URL,
      timeout: 10000,
    });

    this.client.interceptors.request.use((config) => {
      if (this.token) {
        config.headers.Authorization = `Bearer ${this.token}`;
      }
      return config;
    });
  }

  setToken(token: string | null) {
    this.token = token;
  }

  async login(payload: LoginPayload): Promise<AuthResponse> {
    try {
      const response = await this.client.post('/api/auth/callback/credentials', payload);
      return response.data;
    } catch (error) {
      throw new Error('Falha ao fazer login');
    }
  }

  async logout(): Promise<void> {
    try {
      await this.client.post('/api/auth/logout');
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
    }
  }

  async getSolicitacoes(): Promise<Solicitacao[]> {
    try {
      const response = await this.client.get('/api/solicitacoes');
      return response.data;
    } catch (error) {
      throw new Error('Falha ao carregar solicitações');
    }
  }

  async getSolicitacao(id: string): Promise<Solicitacao> {
    try {
      const response = await this.client.get(`/api/solicitacoes/${id}`);
      return response.data;
    } catch (error) {
      throw new Error('Falha ao carregar solicitação');
    }
  }

  async createSolicitacao(data: Partial<Solicitacao>): Promise<Solicitacao> {
    try {
      const response = await this.client.post('/api/solicitacoes', data);
      return response.data;
    } catch (error) {
      throw new Error('Falha ao criar solicitação');
    }
  }

  async approveSolicitacao(id: string): Promise<Solicitacao> {
    try {
      const response = await this.client.patch(`/api/solicitacoes/${id}/approve`);
      return response.data;
    } catch (error) {
      throw new Error('Falha ao aprovar solicitação');
    }
  }

  async rejectSolicitacao(id: string, reason: string): Promise<Solicitacao> {
    try {
      const response = await this.client.patch(`/api/solicitacoes/${id}/reject`, { reason });
      return response.data;
    } catch (error) {
      throw new Error('Falha ao rejeitar solicitação');
    }
  }
}

export const apiClient = new ApiClient();
