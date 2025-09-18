// Minimal Razorpay types for TS
interface RazorpayOptions {
  key: string;
  amount: number; // in paise
  currency: string;
  name?: string;
  description?: string;
  order_id: string;
  prefill?: { name?: string; email?: string; contact?: string };
  notes?: Record<string, string>;
  theme?: { color?: string };
  method?: { upi?: boolean; card?: boolean; netbanking?: boolean; wallet?: boolean; emi?: boolean; paylater?: boolean };
  // New: default method ordering and retry preferences
  config?: {
    display?: {
      blocks?: Record<string, any>;
      sequence?: string[];
      preferences?: { show_default_blocks?: boolean };
    };
    upi?: { flow?: 'collect' | 'intent' };
  };
  retry?: { enabled?: boolean; max_count?: number };
  handler?: (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => void;
  modal?: { ondismiss?: () => void };
}

declare class Razorpay {
  constructor(options: RazorpayOptions);
  open(): void;
  on?(event: 'payment.failed' | string, handler: (response: any) => void): void;
}

declare global {
  interface Window {
    Razorpay?: typeof Razorpay;
  }
}

export {};