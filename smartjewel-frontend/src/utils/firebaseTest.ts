/**
 * Firebase Configuration Test Utility
 * Use this to verify Firebase is properly configured
 */

import { auth } from '../config/firebase';
import { firebaseAuthService } from '../services/firebaseAuth';

export interface FirebaseTestResult {
  isConfigured: boolean;
  errors: string[];
  warnings: string[];
  config: {
    apiKey: string;
    authDomain: string;
    projectId: string;
  };
}

/**
 * Test Firebase configuration and connectivity
 */
export const testFirebaseConfig = async (): Promise<FirebaseTestResult> => {
  const result: FirebaseTestResult = {
    isConfigured: false,
    errors: [],
    warnings: [],
    config: {
      apiKey: '',
      authDomain: '',
      projectId: ''
    }
  };

  try {
    // Check if Firebase is initialized
    if (!auth) {
      result.errors.push('Firebase Auth is not initialized');
      return result;
    }

    // Get config values
    result.config = {
      apiKey: auth.config.apiKey || '',
      authDomain: auth.config.authDomain || '',
      projectId: auth.config.projectId || ''
    };

    // Check required config values
    if (!result.config.apiKey || result.config.apiKey === 'your-api-key') {
      result.errors.push('Firebase API key is missing or using default value');
    }

    if (!result.config.authDomain || result.config.authDomain === 'your-project.firebaseapp.com') {
      result.errors.push('Firebase Auth domain is missing or using default value');
    }

    if (!result.config.projectId || result.config.projectId === 'your-project-id') {
      result.errors.push('Firebase Project ID is missing or using default value');
    }

    // Test Firebase connectivity (this will fail gracefully if not configured)
    try {
      const currentUser = firebaseAuthService.getCurrentUser();
      if (currentUser) {
        result.warnings.push('User is already signed in');
      }
    } catch (error) {
      result.warnings.push('Could not check current user status');
    }

    // If no errors, configuration is valid
    result.isConfigured = result.errors.length === 0;

    return result;
  } catch (error) {
    result.errors.push(`Firebase test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return result;
  }
};

/**
 * Log Firebase test results to console
 */
export const logFirebaseTest = async (): Promise<void> => {
  const result = await testFirebaseConfig();
  
  console.group('🔥 Firebase Configuration Test');
  
  if (result.isConfigured) {
    console.log('✅ Firebase is properly configured');
  } else {
    console.log('❌ Firebase configuration issues detected');
  }
  
  if (result.errors.length > 0) {
    console.group('❌ Errors:');
    result.errors.forEach(error => console.error(`  • ${error}`));
    console.groupEnd();
  }
  
  if (result.warnings.length > 0) {
    console.group('⚠️ Warnings:');
    result.warnings.forEach(warning => console.warn(`  • ${warning}`));
    console.groupEnd();
  }
  
  console.group('📋 Configuration:');
  console.log(`  • API Key: ${result.config.apiKey ? '✓ Set' : '❌ Missing'}`);
  console.log(`  • Auth Domain: ${result.config.authDomain ? '✓ Set' : '❌ Missing'}`);
  console.log(`  • Project ID: ${result.config.projectId ? '✓ Set' : '❌ Missing'}`);
  console.groupEnd();
  
  console.groupEnd();
};

// Auto-run test in development mode
if (import.meta.env.DEV && import.meta.env.VITE_DEBUG_FIREBASE) {
  logFirebaseTest();
}