import { 
  signInWithPopup, 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  updateProfile,
  User as FirebaseUser,
  AuthError
} from 'firebase/auth';
import { auth, googleProvider } from '../config/firebase';

export interface FirebaseAuthResult {
  user: FirebaseUser;
  isNewUser?: boolean;
}

export interface FirebaseAuthError {
  code: string;
  message: string;
}

class FirebaseAuthService {
  /**
   * Sign in with Google using popup
   */
  async signInWithGoogle(): Promise<FirebaseAuthResult> {
    try {
      console.log('[Firebase] Attempting Google sign-in...');
      const result = await signInWithPopup(auth, googleProvider);
      console.log('[Firebase] Google sign-in successful:', result.user.email);
      return {
        user: result.user,
        isNewUser: result.user.metadata.creationTime === result.user.metadata.lastSignInTime
      };
    } catch (error) {
      console.error('[Firebase] Google sign-in error:', error);
      throw this.handleAuthError(error as AuthError);
    }
  }

  /**
   * Sign in with email and password
   */
  async signInWithEmail(email: string, password: string): Promise<FirebaseAuthResult> {
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      return {
        user: result.user
      };
    } catch (error) {
      throw this.handleAuthError(error as AuthError);
    }
  }

  /**
   * Create account with email and password
   */
  async createAccountWithEmail(email: string, password: string): Promise<FirebaseAuthResult> {
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password);
      return {
        user: result.user,
        isNewUser: true
      };
    } catch (error) {
      throw this.handleAuthError(error as AuthError);
    }
  }

  /**
   * Send password reset email
   */
  async sendPasswordReset(email: string): Promise<void> {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (error) {
      throw this.handleAuthError(error as AuthError);
    }
  }

  /**
   * Sign out current user
   */
  async signOut(): Promise<void> {
    try {
      await signOut(auth);
    } catch (error) {
      throw this.handleAuthError(error as AuthError);
    }
  }

  /**
   * Get current user
   */
  getCurrentUser(): FirebaseUser | null {
    return auth.currentUser;
  }

  /**
   * Get current user's ID token
   */
  async getCurrentUserToken(): Promise<string | null> {
    const user = this.getCurrentUser();
    if (!user) return null;
    
    try {
      return await user.getIdToken();
    } catch (error) {
      console.error('Error getting user token:', error);
      return null;
    }
  }

  /**
   * Update current user's profile
   */
  async updateUserProfile(updates: { displayName?: string; photoURL?: string }): Promise<void> {
    const user = this.getCurrentUser();
    if (!user) {
      throw new Error('No user is currently signed in');
    }
    
    try {
      await updateProfile(user, updates);
    } catch (error) {
      throw this.handleAuthError(error as AuthError);
    }
  }

  /**
   * Handle Firebase Auth errors and convert to user-friendly messages
   */
  private handleAuthError(error: AuthError): FirebaseAuthError {
    let message = 'An unexpected error occurred. Please try again.';

    switch (error.code) {
      case 'auth/user-not-found':
        message = 'No account found with this email address.';
        break;
      case 'auth/wrong-password':
        message = 'Incorrect password. Please try again.';
        break;
      case 'auth/invalid-email':
        message = 'Please enter a valid email address.';
        break;
      case 'auth/user-disabled':
        message = 'This account has been disabled. Please contact support.';
        break;
      case 'auth/email-already-in-use':
        message = 'An account with this email already exists.';
        break;
      case 'auth/weak-password':
        message = 'Password should be at least 6 characters long.';
        break;
      case 'auth/popup-closed-by-user':
        message = 'Sign-in was cancelled. Please try again.';
        break;
      case 'auth/popup-blocked':
        message = 'Pop-up was blocked by your browser. Please allow pop-ups and try again.';
        break;
      case 'auth/cancelled-popup-request':
        message = 'Sign-in was cancelled. Please try again.';
        break;
      case 'auth/network-request-failed':
        message = 'Network error. Please check your connection and try again.';
        break;
      case 'auth/too-many-requests':
        message = 'Too many failed attempts. Please try again later.';
        break;
      case 'auth/invalid-credential':
        message = 'Invalid credentials. Please check your email and password.';
        break;
      case 'auth/account-exists-with-different-credential':
        message = 'An account already exists with this email using a different sign-in method.';
        break;
      case 'auth/credential-already-in-use':
        message = 'This credential is already associated with a different account.';
        break;
      case 'auth/operation-not-allowed':
        message = 'This sign-in method is not enabled. Please contact support.';
        break;
      case 'auth/timeout':
        message = 'The operation timed out. Please try again.';
        break;
      case 'auth/missing-android-pkg-name':
      case 'auth/missing-continue-uri':
      case 'auth/missing-ios-bundle-id':
      case 'auth/invalid-continue-uri':
        message = 'Configuration error. Please contact support.';
        break;
      default:
        console.error('Firebase Auth Error:', error);
        break;
    }

    return {
      code: error.code,
      message
    };
  }
}

export const firebaseAuthService = new FirebaseAuthService();