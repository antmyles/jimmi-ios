import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { AuthUser, AuthMethod } from '../types';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api';

export class AuthService {
  private static instance: AuthService;
  private token: string | null = null;
  private user: AuthUser | null = null;

  private constructor() {
    this.loadStoredAuth();
  }

  static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  private async loadStoredAuth() {
    try {
      const storedToken = await AsyncStorage.getItem('auth_token');
      const storedUser = await AsyncStorage.getItem('auth_user');
      if (storedToken) this.token = storedToken;
      if (storedUser) this.user = JSON.parse(storedUser);
    } catch (error) {
      console.error('Failed to load stored auth:', error);
    }
  }

  async signInWithGoogle(idToken: string): Promise<{ user: AuthUser; token: string }> {
    try {
      // Call the tRPC endpoint for Google mobile sign-in
      const response = await axios.post(
        `${API_BASE_URL}/trpc/auth.googleSignInMobile`,
        { idToken }
      );

      const result = response.data?.result?.data;
      if (!result?.token || !result?.user) {
        throw new Error('Invalid response from server');
      }

      await this.storeAuth(result.user, result.token);
      return { user: result.user, token: result.token };
    } catch (error) {
      console.error('Google sign-in failed:', error);
      throw error;
    }
  }

  async signInWithApple(
    identityToken: string,
    email?: string,
    fullName?: string
  ): Promise<{ user: AuthUser; token: string }> {
    try {
      // Call the tRPC endpoint for Apple mobile sign-in
      const response = await axios.post(
        `${API_BASE_URL}/trpc/auth.appleSignInMobile`,
        {
          identityToken,
          email,
          fullName,
        }
      );

      const result = response.data?.result?.data;
      if (!result?.token || !result?.user) {
        throw new Error('Invalid response from server');
      }

      await this.storeAuth(result.user, result.token);
      return { user: result.user, token: result.token };
    } catch (error) {
      console.error('Apple sign-in failed:', error);
      throw error;
    }
  }

  async signInWithEmail(email: string, password: string): Promise<{ user: AuthUser; token: string }> {
    try {
      // Call the tRPC endpoint for email login
      const response = await axios.post(
        `${API_BASE_URL}/trpc/auth.login`,
        { email, password },
        { withCredentials: true } // Important: include cookies for session
      );

      const result = response.data?.result?.data;
      if (!result?.returnPath) {
        throw new Error('Invalid response from server');
      }

      // For mobile, we need to extract user from the session
      // Call auth.me to get the current user after login
      const meResponse = await axios.get(
        `${API_BASE_URL}/trpc/auth.me`,
        { withCredentials: true }
      );
      
      const user = meResponse.data?.result?.data;
      if (!user) {
        throw new Error('Failed to retrieve user after login');
      }

      // Create a JWT token for mobile (since mobile can't use session cookies effectively)
      const token = btoa(JSON.stringify({ openId: user.openId, email: user.email }));
      await this.storeAuth(user, token);
      return { user, token };
    } catch (error) {
      console.error('Email sign-in failed:', error);
      throw error;
    }
  }

  async signUp(email: string, password: string, name: string): Promise<{ user: AuthUser; token: string }> {
    try {
      // Call the tRPC endpoint for signup
      const response = await axios.post(
        `${API_BASE_URL}/trpc/auth.signup`,
        { email, password, name },
        { withCredentials: true } // Important: include cookies for session
      );

      const result = response.data?.result?.data;
      if (!result?.returnPath) {
        throw new Error('Invalid response from server');
      }

      // For mobile, we need to extract user from the session
      // Call auth.me to get the current user after signup
      const meResponse = await axios.get(
        `${API_BASE_URL}/trpc/auth.me`,
        { withCredentials: true }
      );
      
      const user = meResponse.data?.result?.data;
      if (!user) {
        throw new Error('Failed to retrieve user after signup');
      }

      // Create a JWT token for mobile (since mobile can't use session cookies effectively)
      const token = btoa(JSON.stringify({ openId: user.openId, email: user.email }));
      await this.storeAuth(user, token);
      return { user, token };
    } catch (error) {
      console.error('Sign-up failed:', error);
      throw error;
    }
  }

  private async storeAuth(user: AuthUser, token: string) {
    this.user = user;
    this.token = token;
    await AsyncStorage.setItem('auth_token', token);
    await AsyncStorage.setItem('auth_user', JSON.stringify(user));
  }

  async logout() {
    this.user = null;
    this.token = null;
    await AsyncStorage.removeItem('auth_token');
    await AsyncStorage.removeItem('auth_user');
  }

  getToken(): string | null {
    return this.token;
  }

  getUser(): AuthUser | null {
    return this.user;
  }

  isAuthenticated(): boolean {
    return this.token !== null && this.user !== null;
  }
}

export const authService = AuthService.getInstance();
