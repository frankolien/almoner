import { Buffer } from "buffer";
import { Address } from "@stellar/stellar-sdk";
import {
  AssembledTransaction,
  Client as ContractClient,
  ClientOptions as ContractClientOptions,
  MethodOptions,
  Result,
  Spec as ContractSpec,
} from "@stellar/stellar-sdk/contract";
import type {
  u32,
  i32,
  u64,
  i64,
  u128,
  i128,
  u256,
  i256,
  Option,
  Timepoint,
  Duration,
} from "@stellar/stellar-sdk/contract";
export * from "@stellar/stellar-sdk";
export * as contract from "@stellar/stellar-sdk/contract";
export * as rpc from "@stellar/stellar-sdk/rpc";

if (typeof window !== "undefined") {
  //@ts-ignore Buffer exists
  window.Buffer = window.Buffer || Buffer;
}




export const Errors = {
  1: {message:"NotInitialized"},
  2: {message:"ProgramExists"},
  3: {message:"NoProgram"},
  4: {message:"AlreadyClaimed"},
  5: {message:"InvalidProof"},
  6: {message:"InvalidAmount"}
}

export type DataKey = {tag: "Admin", values: void} | {tag: "Token", values: void} | {tag: "Program", values: readonly [u32]} | {tag: "Spent", values: readonly [u32, Buffer]} | {tag: "Nullifiers", values: readonly [u32]};


/**
 * Per-program state: the cohort root, the public policy parameters, and
 * running totals (the totals are convenience views — the authoritative claim
 * record is the spent-nullifier set).
 */
export interface ProgramConfig {
  allowed_region: u32;
  claim_count: u32;
  merkle_root: Buffer;
  min_birth_year: u32;
  required_tier: u32;
  total_claimed: i128;
}


/**
 * A Groth16 proof in Ethereum-compatible uncompressed encoding.
 * a: G1 = be(x) || be(y)                              (64 bytes)
 * b: G2 = be(x.c1) || be(x.c0) || be(y.c1) || be(y.c0) (128 bytes)
 * c: G1 = be(x) || be(y)                              (64 bytes)
 */
export interface Proof {
  a: Buffer;
  b: Buffer;
  c: Buffer;
}

export interface Client {
  /**
   * Construct and simulate a fund transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Fund the USDC pool. Anyone (typically the donor/org) may top it up.
   */
  fund: ({from, amount}: {from: string, amount: i128}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a admin transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  admin: (options?: MethodOptions) => Promise<AssembledTransaction<string>>

  /**
   * Construct and simulate a claim transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * The heart of Almoner. Verify a beneficiary's Groth16 proof and disburse.
   * 
   * There is deliberately **no `require_auth` for the beneficiary**: the
   * proof is the authorization. A relayer or the fresh recipient account can
   * submit it, so the beneficiary's real identity never signs anything.
   * 
   * Checks, in order (matching the architecture doc):
   * 1. submitted root matches the stored root for the program
   * 2. policy params in the public signals match the stored config
   * 3. the nullifier is unused
   * 4. the Groth16 proof verifies against the public signals
   * 5. mark the nullifier spent
   * 6. transfer the USDC to the fresh recipient
   * 
   * Checks 1 and 2 are enforced *by construction*: the contract builds the
   * public-signal vector from its own trusted storage, so a prover who used
   * a different root or a lenient policy simply fails verification.
   */
  claim: ({program_id, nullifier_hash, recipient, payout_amount, proof}: {program_id: u32, nullifier_hash: Buffer, recipient: string, payout_amount: i128, proof: Proof}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a token transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  token: (options?: MethodOptions) => Promise<AssembledTransaction<string>>

  /**
   * Construct and simulate a is_spent transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  is_spent: ({program_id, nullifier_hash}: {program_id: u32, nullifier_hash: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<boolean>>

  /**
   * Construct and simulate a get_program transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_program: ({program_id}: {program_id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Option<ProgramConfig>>>

  /**
   * Construct and simulate a pool_balance transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  pool_balance: (options?: MethodOptions) => Promise<AssembledTransaction<i128>>

  /**
   * Construct and simulate a create_program transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * The org registers a disbursement program: commit the cohort Merkle root
   * and freeze the public policy (region / age / tier). Admin-authorized.
   */
  create_program: ({program_id, merkle_root, allowed_region, min_birth_year, required_tier}: {program_id: u32, merkle_root: Buffer, allowed_region: u32, min_birth_year: u32, required_tier: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a spent_nullifiers transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * The on-chain spent-nullifier set — the auditor matches expected hashes
   * against this to reconstruct exactly who claimed and the program total.
   */
  spent_nullifiers: ({program_id}: {program_id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Array<Buffer>>>

}
export class Client extends ContractClient {
  static async deploy<T = Client>(
        /** Constructor/Initialization Args for the contract's `__constructor` method */
        {admin, token}: {admin: string, token: string},
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options: MethodOptions &
      Omit<ContractClientOptions, "contractId"> & {
        /** The hash of the Wasm blob, which must already be installed on-chain. */
        wasmHash: Buffer | string;
        /** Salt used to generate the contract's ID. Passed through to {@link Operation.createCustomContract}. Default: random. */
        salt?: Buffer | Uint8Array;
        /** The format used to decode `wasmHash`, if it's provided as a string. */
        format?: "hex" | "base64";
      }
  ): Promise<AssembledTransaction<T>> {
    return ContractClient.deploy({admin, token}, options)
  }
  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec([ "AAAABAAAAAAAAAAAAAAABUVycm9yAAAAAAAABgAAAAAAAAAOTm90SW5pdGlhbGl6ZWQAAAAAAAEAAAAAAAAADVByb2dyYW1FeGlzdHMAAAAAAAACAAAAAAAAAAlOb1Byb2dyYW0AAAAAAAADAAAAAAAAAA5BbHJlYWR5Q2xhaW1lZAAAAAAABAAAAAAAAAAMSW52YWxpZFByb29mAAAABQAAAAAAAAANSW52YWxpZEFtb3VudAAAAAAAAAY=",
        "AAAAAgAAAAAAAAAAAAAAB0RhdGFLZXkAAAAABQAAAAAAAAAAAAAABUFkbWluAAAAAAAAAAAAAAAAAAAFVG9rZW4AAAAAAAABAAAAAAAAAAdQcm9ncmFtAAAAAAEAAAAEAAAAAQAAAAAAAAAFU3BlbnQAAAAAAAACAAAABAAAA+4AAAAgAAAAAQAAAAAAAAAKTnVsbGlmaWVycwAAAAAAAQAAAAQ=",
        "AAAAAQAAALZQZXItcHJvZ3JhbSBzdGF0ZTogdGhlIGNvaG9ydCByb290LCB0aGUgcHVibGljIHBvbGljeSBwYXJhbWV0ZXJzLCBhbmQKcnVubmluZyB0b3RhbHMgKHRoZSB0b3RhbHMgYXJlIGNvbnZlbmllbmNlIHZpZXdzIOKAlCB0aGUgYXV0aG9yaXRhdGl2ZSBjbGFpbQpyZWNvcmQgaXMgdGhlIHNwZW50LW51bGxpZmllciBzZXQpLgAAAAAAAAAAAA1Qcm9ncmFtQ29uZmlnAAAAAAAABgAAAAAAAAAOYWxsb3dlZF9yZWdpb24AAAAAAAQAAAAAAAAAC2NsYWltX2NvdW50AAAAAAQAAAAAAAAAC21lcmtsZV9yb290AAAAA+4AAAAgAAAAAAAAAA5taW5fYmlydGhfeWVhcgAAAAAABAAAAAAAAAANcmVxdWlyZWRfdGllcgAAAAAAAAQAAAAAAAAADXRvdGFsX2NsYWltZWQAAAAAAAAL",
        "AAAAAAAAAENGdW5kIHRoZSBVU0RDIHBvb2wuIEFueW9uZSAodHlwaWNhbGx5IHRoZSBkb25vci9vcmcpIG1heSB0b3AgaXQgdXAuAAAAAARmdW5kAAAAAgAAAAAAAAAEZnJvbQAAABMAAAAAAAAABmFtb3VudAAAAAAACwAAAAEAAAPpAAAAAgAAAAM=",
        "AAAAAAAAAAAAAAAFYWRtaW4AAAAAAAAAAAAAAQAAABM=",
        "AAAAAAAAAzNUaGUgaGVhcnQgb2YgQWxtb25lci4gVmVyaWZ5IGEgYmVuZWZpY2lhcnkncyBHcm90aDE2IHByb29mIGFuZCBkaXNidXJzZS4KClRoZXJlIGlzIGRlbGliZXJhdGVseSAqKm5vIGByZXF1aXJlX2F1dGhgIGZvciB0aGUgYmVuZWZpY2lhcnkqKjogdGhlCnByb29mIGlzIHRoZSBhdXRob3JpemF0aW9uLiBBIHJlbGF5ZXIgb3IgdGhlIGZyZXNoIHJlY2lwaWVudCBhY2NvdW50IGNhbgpzdWJtaXQgaXQsIHNvIHRoZSBiZW5lZmljaWFyeSdzIHJlYWwgaWRlbnRpdHkgbmV2ZXIgc2lnbnMgYW55dGhpbmcuCgpDaGVja3MsIGluIG9yZGVyIChtYXRjaGluZyB0aGUgYXJjaGl0ZWN0dXJlIGRvYyk6CjEuIHN1Ym1pdHRlZCByb290IG1hdGNoZXMgdGhlIHN0b3JlZCByb290IGZvciB0aGUgcHJvZ3JhbQoyLiBwb2xpY3kgcGFyYW1zIGluIHRoZSBwdWJsaWMgc2lnbmFscyBtYXRjaCB0aGUgc3RvcmVkIGNvbmZpZwozLiB0aGUgbnVsbGlmaWVyIGlzIHVudXNlZAo0LiB0aGUgR3JvdGgxNiBwcm9vZiB2ZXJpZmllcyBhZ2FpbnN0IHRoZSBwdWJsaWMgc2lnbmFscwo1LiBtYXJrIHRoZSBudWxsaWZpZXIgc3BlbnQKNi4gdHJhbnNmZXIgdGhlIFVTREMgdG8gdGhlIGZyZXNoIHJlY2lwaWVudAoKQ2hlY2tzIDEgYW5kIDIgYXJlIGVuZm9yY2VkICpieSBjb25zdHJ1Y3Rpb24qOiB0aGUgY29udHJhY3QgYnVpbGRzIHRoZQpwdWJsaWMtc2lnbmFsIHZlY3RvciBmcm9tIGl0cyBvd24gdHJ1c3RlZCBzdG9yYWdlLCBzbyBhIHByb3ZlciB3aG8gdXNlZAphIGRpZmZlcmVudCByb290IG9yIGEgbGVuaWVudCBwb2xpY3kgc2ltcGx5IGZhaWxzIHZlcmlmaWNhdGlvbi4AAAAABWNsYWltAAAAAAAABQAAAAAAAAAKcHJvZ3JhbV9pZAAAAAAABAAAAAAAAAAObnVsbGlmaWVyX2hhc2gAAAAAA+4AAAAgAAAAAAAAAAlyZWNpcGllbnQAAAAAAAATAAAAAAAAAA1wYXlvdXRfYW1vdW50AAAAAAAACwAAAAAAAAAFcHJvb2YAAAAAAAfQAAAABVByb29mAAAAAAAAAQAAA+kAAAACAAAAAw==",
        "AAAAAAAAAAAAAAAFdG9rZW4AAAAAAAAAAAAAAQAAABM=",
        "AAAAAAAAAAAAAAAIaXNfc3BlbnQAAAACAAAAAAAAAApwcm9ncmFtX2lkAAAAAAAEAAAAAAAAAA5udWxsaWZpZXJfaGFzaAAAAAAD7gAAACAAAAABAAAAAQ==",
        "AAAAAAAAAAAAAAALZ2V0X3Byb2dyYW0AAAAAAQAAAAAAAAAKcHJvZ3JhbV9pZAAAAAAABAAAAAEAAAPoAAAH0AAAAA1Qcm9ncmFtQ29uZmlnAAAA",
        "AAAAAAAAAAAAAAAMcG9vbF9iYWxhbmNlAAAAAAAAAAEAAAAL",
        "AAAAAAAAAEhEZXBsb3ktdGltZSBjb25zdHJ1Y3RvcjogYmluZCB0aGUgb3JnYW5pemF0aW9uIGFkbWluIGFuZCB0aGUgVVNEQyB0b2tlbi4AAAANX19jb25zdHJ1Y3RvcgAAAAAAAAIAAAAAAAAABWFkbWluAAAAAAAAEwAAAAAAAAAFdG9rZW4AAAAAAAATAAAAAA==",
        "AAAAAAAAAI1UaGUgb3JnIHJlZ2lzdGVycyBhIGRpc2J1cnNlbWVudCBwcm9ncmFtOiBjb21taXQgdGhlIGNvaG9ydCBNZXJrbGUgcm9vdAphbmQgZnJlZXplIHRoZSBwdWJsaWMgcG9saWN5IChyZWdpb24gLyBhZ2UgLyB0aWVyKS4gQWRtaW4tYXV0aG9yaXplZC4AAAAAAAAOY3JlYXRlX3Byb2dyYW0AAAAAAAUAAAAAAAAACnByb2dyYW1faWQAAAAAAAQAAAAAAAAAC21lcmtsZV9yb290AAAAA+4AAAAgAAAAAAAAAA5hbGxvd2VkX3JlZ2lvbgAAAAAABAAAAAAAAAAObWluX2JpcnRoX3llYXIAAAAAAAQAAAAAAAAADXJlcXVpcmVkX3RpZXIAAAAAAAAEAAAAAQAAA+kAAAACAAAAAw==",
        "AAAAAAAAAI9UaGUgb24tY2hhaW4gc3BlbnQtbnVsbGlmaWVyIHNldCDigJQgdGhlIGF1ZGl0b3IgbWF0Y2hlcyBleHBlY3RlZCBoYXNoZXMKYWdhaW5zdCB0aGlzIHRvIHJlY29uc3RydWN0IGV4YWN0bHkgd2hvIGNsYWltZWQgYW5kIHRoZSBwcm9ncmFtIHRvdGFsLgAAAAAQc3BlbnRfbnVsbGlmaWVycwAAAAEAAAAAAAAACnByb2dyYW1faWQAAAAAAAQAAAABAAAD6gAAA+4AAAAg",
        "AAAAAQAAAPxBIEdyb3RoMTYgcHJvb2YgaW4gRXRoZXJldW0tY29tcGF0aWJsZSB1bmNvbXByZXNzZWQgZW5jb2RpbmcuCmE6IEcxID0gYmUoeCkgfHwgYmUoeSkgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAoNjQgYnl0ZXMpCmI6IEcyID0gYmUoeC5jMSkgfHwgYmUoeC5jMCkgfHwgYmUoeS5jMSkgfHwgYmUoeS5jMCkgKDEyOCBieXRlcykKYzogRzEgPSBiZSh4KSB8fCBiZSh5KSAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICg2NCBieXRlcykAAAAAAAAABVByb29mAAAAAAAAAwAAAAAAAAABYQAAAAAAA+4AAABAAAAAAAAAAAFiAAAAAAAD7gAAAIAAAAAAAAAAAWMAAAAAAAPuAAAAQA==" ]),
      options
    )
  }
  public readonly fromJSON = {
    fund: this.txFromJSON<Result<void>>,
        admin: this.txFromJSON<string>,
        claim: this.txFromJSON<Result<void>>,
        token: this.txFromJSON<string>,
        is_spent: this.txFromJSON<boolean>,
        get_program: this.txFromJSON<Option<ProgramConfig>>,
        pool_balance: this.txFromJSON<i128>,
        create_program: this.txFromJSON<Result<void>>,
        spent_nullifiers: this.txFromJSON<Array<Buffer>>
  }
}