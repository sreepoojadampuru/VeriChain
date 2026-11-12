// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract CredentialRegistry {
    address public owner;

    struct Credential {
        bytes32 dataHash;
        address issuer;
        uint256 issuedAt;
        bool revoked;
    }

    mapping(bytes32 => Credential) private credentials;

    event CredentialIssued(bytes32 indexed credentialId, address indexed issuer, bytes32 dataHash);
    event CredentialRevoked(bytes32 indexed credentialId);

    constructor() { owner = msg.sender; }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner allowed");
        _;
    }

    function issueCredential(bytes32 credentialId, bytes32 dataHash) external onlyOwner {
        require(credentialId != bytes32(0), "Invalid ID");
        require(dataHash != bytes32(0), "Invalid hash");
        require(credentials[credentialId].issuedAt == 0, "Credential already exists");
        credentials[credentialId] = Credential(dataHash, msg.sender, block.timestamp, false);
        emit CredentialIssued(credentialId, msg.sender, dataHash);
    }

    function verifyCredential(bytes32 credentialId, bytes32 dataHash) external view returns (bool) {
        Credential memory c = credentials[credentialId];
        return c.issuedAt != 0 && c.dataHash == dataHash && !c.revoked;
    }

    function revokeCredential(bytes32 credentialId) external onlyOwner {
        require(credentials[credentialId].issuedAt != 0, "Credential not found");
        require(!credentials[credentialId].revoked, "Already revoked");
        credentials[credentialId].revoked = true;
        emit CredentialRevoked(credentialId);
    }

    function getCredential(bytes32 credentialId)
        external view returns (bytes32 dataHash, address issuer, uint256 issuedAt, bool revoked)
    {
        Credential memory c = credentials[credentialId];
        require(c.issuedAt != 0, "Credential not found");
        return (c.dataHash, c.issuer, c.issuedAt, c.revoked);
    }
}
