#!/usr/bin/env bash
#
# Compile aid_claim.circom and run a full Groth16 trusted setup over BN254.
# Powers of Tau is generated locally (no network download). Re-running is cheap:
# the ptau file is cached and only the zkey/vkey are regenerated.
#
set -euo pipefail
cd "$(dirname "$0")/.."

CIRCUIT=aid_claim
PTAU_POWER=${PTAU_POWER:-15}
BUILD=build
# snarkjs is a workspace dep; npm run puts node_modules/.bin on PATH, but resolve
# explicitly so the script also works when invoked directly.
SNARKJS="$(command -v snarkjs || echo "npx --no-install snarkjs")"

mkdir -p "$BUILD"

echo "▸ Compiling $CIRCUIT.circom (BN254)…"
circom "src/$CIRCUIT.circom" \
  --r1cs --wasm --sym \
  -l node_modules \
  -l ../node_modules \
  -o "$BUILD"

echo "▸ Circuit info:"
$SNARKJS r1cs info "$BUILD/$CIRCUIT.r1cs"

# ---- Powers of Tau (phase 1, universal) — generated locally ----
PTAU="$BUILD/pot${PTAU_POWER}_final.ptau"
if [ ! -f "$PTAU" ]; then
  echo "▸ Generating Powers of Tau (2^$PTAU_POWER) locally…"
  $SNARKJS powersoftau new bn128 "$PTAU_POWER" "$BUILD/pot_0000.ptau" -v
  $SNARKJS powersoftau contribute "$BUILD/pot_0000.ptau" "$BUILD/pot_0001.ptau" \
    --name="almoner-dev-1" -v -e="almoner ptau entropy $(date +%s)-$RANDOM"
  $SNARKJS powersoftau prepare phase2 "$BUILD/pot_0001.ptau" "$PTAU" -v
  rm -f "$BUILD/pot_0000.ptau" "$BUILD/pot_0001.ptau"
fi

# ---- Groth16 setup (phase 2, circuit-specific) ----
echo "▸ Groth16 setup…"
$SNARKJS groth16 setup "$BUILD/$CIRCUIT.r1cs" "$PTAU" "$BUILD/${CIRCUIT}_0000.zkey"
$SNARKJS zkey contribute "$BUILD/${CIRCUIT}_0000.zkey" "$BUILD/${CIRCUIT}.zkey" \
  --name="almoner-dev-2" -v -e="almoner phase2 entropy $(date +%s)-$RANDOM"
$SNARKJS zkey export verificationkey "$BUILD/${CIRCUIT}.zkey" "$BUILD/${CIRCUIT}.vkey.json"
rm -f "$BUILD/${CIRCUIT}_0000.zkey"

# Sync the runtime artifacts the browser proves with into the app.
APP_CIRCUIT="../app/public/circuit"
mkdir -p "$APP_CIRCUIT"
cp "$BUILD/${CIRCUIT}_js/${CIRCUIT}.wasm" "$BUILD/${CIRCUIT}.zkey" "$BUILD/${CIRCUIT}.vkey.json" "$APP_CIRCUIT/"
echo "▸ Synced wasm/zkey/vkey into $APP_CIRCUIT"

echo ""
echo "✓ Build complete. Key artifacts:"
echo "    $BUILD/${CIRCUIT}_js/${CIRCUIT}.wasm   (witness generator, used in-browser)"
echo "    $BUILD/${CIRCUIT}.zkey                  (proving key)"
echo "    $BUILD/${CIRCUIT}.vkey.json             (verification key -> Soroban verifier)"
