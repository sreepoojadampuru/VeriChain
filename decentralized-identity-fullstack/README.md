# VeriChain — Decentralized Identity and Verifiable Credentials

Full-stack academic prototype: React/Vite frontend, Express backend, Solidity smart contract, and MetaMask wallet integration.

## Requirements
- Node.js 20+ and npm
- MetaMask browser extension
- Remix IDE and a local Ethereum-compatible development chain (Ganache or another compatible local node)

## 1. Deploy the smart contract
1. Open `contracts/CredentialRegistry.sol` in Remix.
2. Compile with Solidity 0.8.20 or a compatible 0.8.x compiler.
3. Deploy to your local development chain. The wallet that deploys becomes the only issuer/revoker (`owner`).
4. Copy the deployed contract address.
5. In MetaMask, connect to the same network used for deployment. For a local Ganache node, configure its RPC URL and chain ID as provided by your Ganache instance. Use only local development accounts.

## 2. Start backend
```bash
cd backend
npm install
npm run dev
```
Backend: http://localhost:4000. Health check: http://localhost:4000/api/health.

The backend creates `src/credentials.json` for demo metadata. This local JSON store is for a single-machine demo only, not production.

## 3. Configure and start frontend
```bash
cd frontend
npm install
```
Copy `.env.example` to `.env`, then replace `VITE_CONTRACT_ADDRESS` with the actual deployed contract address. Keep `VITE_API_URL=http://localhost:4000`.
```bash
npm run dev
```
Open the URL Vite prints (normally http://localhost:5173).

## 4. Demo
1. Connect MetaMask.
2. Issue a test credential with dummy information.
3. Approve the MetaMask transaction; wait for confirmation.
4. Copy its credential ID and use Verify.
5. Open Registry and revoke the test credential. Verify again; it should fail.

## Important limitations
- This is a learning prototype, not a production-ready decentralized identity solution.
- The backend JSON file is not authenticated or durable and must not be exposed to the internet.
- The contract currently has one owner/issuer. Production needs access controls, key management, audit, secure storage, and stronger identity/issuer workflows.
- Do not store personal data or full certificates on-chain. Use dummy data for your academic demo.
- The prototype uses a hash-based registry; it is not a complete W3C Verifiable Credentials / DID implementation.
