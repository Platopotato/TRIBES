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

export function getUserQuestion(username: string): string | null {
    client.getUserQuestion(username);
    // This is async via socket.io, return null for now
    return null;
}

export function verifySecurityAnswer(username: string, answer: string): boolean {
    client.verifySecurityAnswer({ username, answer });
    // This is async via socket.io, return false for now
    return false;
}

export function resetPassword(username: string, newPassword: string): boolean {
    client.resetPassword({ username, newPassword });
    // This is async via socket.io, return false for now
    return false;
}