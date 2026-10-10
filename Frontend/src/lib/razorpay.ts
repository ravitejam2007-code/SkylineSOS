/**
 * Razorpay Payment Gateway Integration for SkylineSOS (Test Mode)
 * API Key: rzp_test_T8GBnZ6P23gRoO
 */

export const RAZORPAY_TEST_KEY_ID = 'rzp_test_T8GBnZ6P23gRoO';

export function getRazorpayKeyId(): string {
  if (typeof import.meta !== 'undefined' && import.meta.env?.PUBLIC_RAZORPAY_KEY_ID) {
    return import.meta.env.PUBLIC_RAZORPAY_KEY_ID;
  }
  return RAZORPAY_TEST_KEY_ID;
}

/**
 * Dynamically loads Razorpay checkout.js script if not present on window.
 */
export async function loadRazorpaySDK(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if ((window as any).Razorpay) return true;

  return new Promise((resolve) => {
    const existingScript = document.querySelector('script[src*="checkout.razorpay.com"]');
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(true));
      existingScript.addEventListener('error', () => resolve(false));
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => {
      console.error('Failed to load Razorpay checkout SDK');
      resolve(false);
    };
    document.head.appendChild(script);
  });
}

export interface RazorpayCheckoutOptions {
  amountPaise: number;
  name?: string;
  description: string;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  notes?: Record<string, string>;
  orderId?: string;
}

export interface RazorpayPaymentResult {
  success: boolean;
  paymentId: string;
  orderId?: string;
  signature?: string;
  amountPaise: number;
}

/**
 * Opens Razorpay standard checkout popup.
 * Resolves ONLY when payment handler executes with payment_id.
 * Rejects if user dismisses/closes modal or payment fails.
 */
export async function openRazorpayCheckout(
  options: RazorpayCheckoutOptions
): Promise<RazorpayPaymentResult> {
  if (typeof window === 'undefined') {
    throw new Error('Razorpay checkout is only supported in browser environment');
  }

  const loaded = await loadRazorpaySDK();
  if (!loaded || !(window as any).Razorpay) {
    throw new Error('Unable to initialize Razorpay payment gateway. Please check your internet connection.');
  }

  // Razorpay standard requires minimum 100 paise (₹1.00) in INR
  const effectiveAmountPaise = Math.max(100, Math.round(options.amountPaise));

  return new Promise<RazorpayPaymentResult>((resolve, reject) => {
    try {
      const key = getRazorpayKeyId();
      const rzpOptions: any = {
        key,
        amount: effectiveAmountPaise,
        currency: 'INR',
        name: options.name || 'Skyline Student Association',
        description: options.description,
        image: '/favicon.svg',
        prefill: {
          name: options.prefill?.name || '',
          email: options.prefill?.email || '',
          contact: options.prefill?.contact || '9876543210',
        },
        notes: {
          organization: 'SkylineSOS',
          ...options.notes,
        },
        theme: {
          color: '#000000', // Strict black styling
        },
        handler: function (response: any) {
          if (response && response.razorpay_payment_id) {
            resolve({
              success: true,
              paymentId: response.razorpay_payment_id,
              orderId: response.razorpay_order_id,
              signature: response.razorpay_signature,
              amountPaise: effectiveAmountPaise,
            });
          } else {
            reject(new Error('Payment settlement incomplete: No payment ID returned by Razorpay.'));
          }
        },
        modal: {
          ondismiss: function () {
            reject(new Error('Payment was cancelled or closed by user. Transaction not settled.'));
          },
        },
      };

      if (options.orderId) {
        rzpOptions.order_id = options.orderId;
      }

      const rzp = new (window as any).Razorpay(rzpOptions);
      rzp.on('payment.failed', function (resp: any) {
        const desc = resp?.error?.description || resp?.error?.reason || 'Payment failed';
        reject(new Error(`Razorpay Payment Failed: ${desc}`));
      });

      rzp.open();
    } catch (err: any) {
      reject(err);
    }
  });
}
