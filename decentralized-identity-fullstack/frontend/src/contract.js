export const ABI = [
  { "inputs": [], "stateMutability": "nonpayable", "type": "constructor" },
  { "inputs": [], "name": "owner", "outputs": [{ "internalType": "address", "name": "", "type": "address" }], "stateMutability": "view", "type": "function" },
  { "anonymous": false, "inputs": [{ "indexed": true, "internalType": "bytes32", "name": "credentialId", "type": "bytes32" }, { "indexed": true, "internalType": "address", "name": "issuer", "type": "address" }, { "indexed": false, "internalType": "bytes32", "name": "dataHash", "type": "bytes32" }], "name": "CredentialIssued", "type": "event" },
  { "anonymous": false, "inputs": [{ "indexed": true, "internalType": "bytes32", "name": "credentialId", "type": "bytes32" }], "name": "CredentialRevoked", "type": "event" },
  { "inputs": [{ "internalType": "bytes32", "name": "credentialId", "type": "bytes32" }, { "internalType": "bytes32", "name": "dataHash", "type": "bytes32" }], "name": "issueCredential", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [{ "internalType": "bytes32", "name": "credentialId", "type": "bytes32" }], "name": "revokeCredential", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [{ "internalType": "bytes32", "name": "credentialId", "type": "bytes32" }, { "internalType": "bytes32", "name": "dataHash", "type": "bytes32" }], "name": "verifyCredential", "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }], "stateMutability": "view", "type": "function" },
  { "inputs": [{ "internalType": "bytes32", "name": "credentialId", "type": "bytes32" }], "name": "getCredential", "outputs": [{ "internalType": "bytes32", "name": "dataHash", "type": "bytes32" }, { "internalType": "address", "name": "issuer", "type": "address" }, { "internalType": "uint256", "name": "issuedAt", "type": "uint256" }, { "internalType": "bool", "name": "revoked", "type": "bool" }], "stateMutability": "view", "type": "function" }
];
