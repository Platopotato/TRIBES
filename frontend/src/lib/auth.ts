import { User } from '../../../shared/dist/index.js';
import * as client from './client';

export function register(username: string, password: string, securityQuestion: string, securityAnswer: string) {
    client.register({ username, password, securityQuestion, securityAnswer });
}

export function login(username: string, password: string): void {
    client.login({ username, password });
}

export function logout(): void {
    sessionStorage.removeItem('radix_user');
}

export function getCurrentUser(): User | null {
    const userJson = sessionStorage.getItem('radix_user');
    if (userJson) {
        try {
            return JSON.parse(userJson);
        } catch (e) {
            return null;
        }
    }
    return null;
}

export function refreshCurrentUserInSession(user: User): void {
    sessionStorage.setItem('radix_user', JSON.stringify(user));
}

export function getUserQuestion(username: string) {
    client.getUserQuestion(username);
}

export function verifySecurityAnswer(username: string, answer: string) {
    client.verifySecurityAnswer({ username, answer });
}

export function resetPassword(username: string, newPassword: string) {
    client.resetPassword({ username, newPassword });
}