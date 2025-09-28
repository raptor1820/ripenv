# ripenv

**ripenv** is a comprehensive, military-grade solution for managing encrypted environment files and API secrets across development teams. Built with a security-first approach, ripenv addresses the critical challenge of secret management in modern software development workflows.

## 🚨 The Critical Need for Secret Management

The software industry faces an unprecedented crisis in secret management:

-   **18,000+ exposed API secrets** discovered across 1 million domains in the web, including Discord webhooks and critical service tokens ([The API Secret Sprawl Report](https://escape.tech/the-api-secret-sprawl-2024))
-   **3,325 secrets compromised** in the Ghost Action supply chain attack (September 8, 2025), affecting PyPI, npm, and DockerHub tokens through malicious GitHub workflows([Git Guardian](https://blog.gitguardian.com/ghostaction-campaign-3-325-secrets-stolen/))
-   **12.8 million secrets accidentally leaked** on public GitHub repositories in 2023 alone([Infosecurity Magazine](https://www.infosecurity-magazine.com/news/13-million-secrets-public-github/))

ripenv provides a robust, cryptographically secure solution to prevent these devastating security breaches while maintaining developer productivity.

## ✨ Key Features

### 🔐 **Zero-Trust Cryptography**

-   **Client-side encryption** using industry-standard algorithms (X25519, XSalsa20-Poly1305, Argon2id)
-   **Private keys never leave your machine** in plaintext form
-   **Per-file key rotation** with individual recipient wrapping
-   **Forward secrecy** through ephemeral key generation

### 👥 **Team Management**

-   **Web-based dashboard** for project and team member management
-   **Granular access controls** with project-based permissions
-   **Automatic recipient synchronization** via Supabase integration
-   **Email-based invitation system** with secure onboarding

### 🛠️ **Developer Experience**

-   **Intuitive CLI** with rich terminal output and progress indicators
-   **Natural language input** via Google Gemini integration for command parsing
-   **Seamless CI/CD integration** with automated secret rotation
-   **Cross-platform support** (Windows, macOS, Linux)

### 🔄 **Automated Workflows**

-   **Smart rotation reminders** with configurable intervals
-   **Supabase integration** for real-time team synchronization
-   **Git-friendly** encrypted files that can be safely committed
-   **Automated cleanup** and secure deletion of plaintext files

## 🏗️ Architecture & Tech Stack

### **Frontend (Web Dashboard)**

-   **Framework**: Next.js 14 with App Router
-   **UI/UX**: Tailwind CSS with custom cyberpunk-inspired design
-   **Authentication**: Supabase Auth with magic link authentication
-   **Cryptography**: WebCrypto API + TweetNaCl for browser-based key generation
-   **State Management**: React hooks with TypeScript
-   **Deployment**: Vercel-ready with optimized builds

### **Backend (CLI & API)**

-   **Language**: Python 3.10+ with async/await support
-   **Cryptography**: PyNaCl (libsodium bindings) for high-performance crypto operations
-   **Password Hashing**: Argon2id with secure parameter tuning
-   **Database**: Supabase (PostgreSQL) with Row Level Security (RLS)
-   **CLI Framework**: Click with Rich for enhanced terminal UI
-   **AI Integration**: Google Gemini for natural language command processing

## 🔒 Security Model & Threat Analysis

### **Cryptographic Guarantees**

-   **Confidentiality**: XSalsa20-Poly1305 authenticated encryption
-   **Integrity**: Built-in authentication tags prevent tampering
-   **Forward Secrecy**: Ephemeral keys are rotated per encryption operation
-   **Key Derivation**: Argon2id with tuned parameters resistant to GPU attacks

### **Trust Boundaries**

-   **Client-side key generation**: Private keys never transmitted
-   **Zero-knowledge architecture**: Server only stores encrypted data and public keys
-   **Compartmentalized access**: Project-based isolation with granular permissions
-   **Audit trail**: Comprehensive logging of all cryptographic operations

### **Threat Mitigation**

-   ✅ **Insider threats**: Encrypted at rest with individual key wrapping
-   ✅ **Supply chain attacks**: Cryptographic verification of all operations
-   ✅ **Data breaches**: Zero plaintext exposure on server infrastructure
-   ✅ **Credential theft**: Automatic rotation with configurable intervals
-   ✅ **Social engineering**: Multi-factor authentication via email verification

## 📊 Usage Statistics & Impact

### **Supported Secret Types**

-   API keys and tokens (AWS, GCP, Azure, etc.)
-   Database connection strings
-   OAuth credentials and refresh tokens
-   Webhook URLs and signing secrets
-   Certificate and private key materials
-   Custom environment configurations
-   **Anything and everything you want**

### **Enterprise Adoption**

-   **Development Teams**: Secure collaboration on sensitive projects
-   **CI/CD Pipelines**: Automated deployment with encrypted secrets

## 🔄 Rotation & Lifecycle Management

### **Automated Rotation Reminders**

-   Configurable reminder intervals (30, 60, 90 days)
-   Supabase Edge Functions for reliable delivery
-   Team-wide coordination of rotation schedules

### **Secret Lifecycle**

1. **Generation**: Secure random key generation with proper entropy
2. **Distribution**: Encrypted individual wrapping for each team member
3. **Usage**: Decryption only on authorized developer machines
4. **Rotation**: Seamless key rotation with backward compatibility
5. **Revocation**: Immediate access removal for departing team members

## 🤝 Contributing

We welcome contributions from the security and development community:

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** your changes (`git commit -m 'Add amazing feature'`)
4. **Push** to the branch (`git push origin feature/amazing-feature`)
5. **Open** a Pull Request

## ⚠️ Security Disclosure

If you discover a security vulnerability, please create a new issue. All security vulnerabilities will be promptly addressed.

---

**ripenv** - _Git maintains your code. We protect your secrets._
