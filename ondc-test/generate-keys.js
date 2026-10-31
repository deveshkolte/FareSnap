const crypto = require('crypto');

/**
 * Generates Ed25519 Signing Keypair + X25519 Encryption Keypair in Base64 DER format
 * required for registering FareSnap as an ONDC Buyer App Participant (ONDC:TRV10).
 */
function generateOndcKeypairs() {
  const signing = crypto.generateKeyPairSync('ed25519', {
    publicKeyEncoding: { type: 'spki', format: 'der' },
    privateKeyEncoding: { type: 'pkcs8', format: 'der' },
  });

  const encryption = crypto.generateKeyPairSync('x25519', {
    publicKeyEncoding: { type: 'spki', format: 'der' },
    privateKeyEncoding: { type: 'pkcs8', format: 'der' },
  });

  const result = {
    bap_id: process.env.ONDC_BAP_ID || 'faresnap.bap.ondc.org',
    unique_key_id: `faresnap-key-${Date.now()}`,
    signing_public_key: signing.publicKey.toString('base64'),
    signing_private_key: signing.privateKey.toString('base64'),
    encryption_public_key: encryption.publicKey.toString('base64'),
    encryption_private_key: encryption.privateKey.toString('base64'),
  };

  console.log('=== ONDC Buyer App (ONDC:TRV10) Ed25519 + X25519 Keys ===');
  console.log(`ONDC_BAP_ID=${result.bap_id}`);
  console.log(`ONDC_UNIQUE_KEY_ID=${result.unique_key_id}`);
  console.log(`ONDC_BAP_PUBLIC_KEY=${result.signing_public_key}`);
  console.log(`ONDC_BAP_PRIVATE_KEY=${result.signing_private_key}`);
  console.log(`ONDC_ENCRYPTION_PUBLIC_KEY=${result.encryption_public_key}`);
  console.log(`ONDC_ENCRYPTION_PRIVATE_KEY=${result.encryption_private_key}`);
  return result;
}

if (require.main === module) {
  generateOndcKeypairs();
}

module.exports = { generateOndcKeypairs };
