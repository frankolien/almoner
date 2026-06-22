// Minimal ambient declarations for libraries that ship no types.

declare module 'circomlibjs' {
  export interface PoseidonField {
    toObject(x: unknown): bigint;
  }
  export interface PoseidonFn {
    (inputs: Array<bigint | number | string>): unknown;
    F: PoseidonField;
  }
  export function buildPoseidon(): Promise<PoseidonFn>;
}

declare module 'snarkjs' {
  export interface Groth16Proof {
    pi_a: string[];
    pi_b: string[][];
    pi_c: string[];
    protocol: string;
    curve: string;
  }
  export type PublicSignals = string[];
  export const groth16: {
    fullProve(
      input: Record<string, unknown>,
      wasm: string | Uint8Array,
      zkey: string | Uint8Array,
    ): Promise<{ proof: Groth16Proof; publicSignals: PublicSignals }>;
    verify(
      vkey: unknown,
      publicSignals: PublicSignals,
      proof: Groth16Proof,
    ): Promise<boolean>;
  };
}
