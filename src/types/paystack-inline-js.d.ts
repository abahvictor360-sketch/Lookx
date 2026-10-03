// Minimal types for @paystack/inline-js (the package ships none).
// Shapes from the package README: PaystackPop.resumeTransaction(accessCode, callbacks).
declare module "@paystack/inline-js" {
  export type PaystackCallbacks = {
    onSuccess?: (tx: { id: number; reference: string; message: string }) => void;
    onCancel?: () => void;
    onError?: (error: { message: string }) => void;
    onLoad?: (tx: { id: number; customer: unknown; accessCode: string }) => void;
  };
  export default class PaystackPop {
    resumeTransaction(accessCode: string, callbacks?: PaystackCallbacks): unknown;
  }
}
