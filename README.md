# ripenv
**ripenv** is a comprehensive, enterprise-grade solution for managing encrypted environment files and API secrets across development teams. Built with a security-first approach, ripenv addresses the critical challenge of secret management in modern software development workflows.

## 🚨 The Critical Need for Secret Management

The software industry faces an unprecedented crisis in secret management:

- **18,000+ exposed API secrets** discovered across 1 million domains in the web, including Discord webhooks and critical service tokens ([The API Secret Sprawl Report](https://escape.tech/the-api-secret-sprawl-2024))
- **3,325 secrets compromised** in the Ghost Action supply chain attack (September 8, 2025), affecting PyPI, npm, and DockerHub tokens through malicious GitHub workflows([Git Guardian](https://blog.gitguardian.com/ghostaction-campaign-3-325-secrets-stolen/))
- **12.8 million secrets accidentally leaked** on public GitHub repositories in 2023 alone([Infosecurity Magazine](https://www.infosecurity-magazine.com/news/13-million-secrets-public-github/))

ripenv provides a robust, cryptographically secure solution to prevent these devastating security breaches while maintaining developer productivity.

## ✨ Key Features

### 🔐 **Zero-Trust Cryptography**
- **Client-side encryption** using industry-standard algorithms (X25519, XSalsa20-Poly1305, Argon2id)
- **Private keys never leave your machine** in plaintext form
- **Per-file key rotation** with individual recipient wrapping
- **Forward secrecy** through ephemeral key generation

### 👥 **Team Management**
- **Web-based dashboard** for project and team member management
- **Granular access controls** with project-based permissions
- **Automatic recipient synchronization** via Supabase integration
- **Email-based invitation system** with secure onboarding

### 🛠️ **Developer Experience**
- **Intuitive CLI** with rich terminal output and progress indicators
- **Natural language processing** via Google Gemini integration for command parsing
- **Seamless CI/CD integration** with automated secret rotation
- **Cross-platform support** (Windows, macOS, Linux)

### 🔄 **Automated Workflows**
- **Smart rotation reminders** with configurable intervals
- **Supabase integration** for real-time team synchronization
- **Git-friendly** encrypted files that can be safely committed
- **Automated cleanup** and secure deletion of plaintext files

## 🏗️ Architecture & Tech Stack

### **Frontend (Web Dashboard)**
- **Framework**: Next.js 14 with App Router
- **UI/UX**: Tailwind CSS with custom cyberpunk-inspired design
- **Authentication**: Supabase Auth with magic link authentication
- **Cryptography**: WebCrypto API + TweetNaCl for browser-based key generation
- **State Management**: React hooks with TypeScript
- **Deployment**: Vercel-ready with optimized builds

### **Backend (CLI & API)**
- **Language**: Python 3.10+ with async/await support
- **Cryptography**: PyNaCl (libsodium bindings) for high-performance crypto operations
- **Password Hashing**: Argon2id with secure parameter tuning
- **Database**: Supabase (PostgreSQL) with Row Level Security (RLS)
- **CLI Framework**: Click with Rich for enhanced terminal UI
- **AI Integration**: Google Gemini for natural language command processing

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ and npm/pnpm
- **Python** 3.10+ with pip
- **Supabase** project with configured authentication
- **Git** for version control

### 1. Clone and Setup

```bash
git clone https://github.com/raptor1820/ripenv.git
cd ripenv
```

### 2. Web Dashboard Setup

```bash
cd web
pnpm install
cp .env.local.example .env.local
# Configure your Supabase URL and anon key in .env.local
pnpm dev
```

Visit `http://localhost:3000`, sign in via magic link, and generate your cryptographic keypair.

### 3. CLI Installation

```bash
cd ../cli
pip install -e .
```

Set up environment variables:
```bash
# PowerShell (Windows)
$env:RIPENV_SUPABASE_URL = "https://your-project-id.supabase.co"
$env:RIPENV_SUPABASE_ANON_KEY = "your-anon-key"

# Bash/Zsh (macOS/Linux)
export RIPENV_SUPABASE_URL="https://your-project-id.supabase.co"
export RIPENV_SUPABASE_ANON_KEY="your-anon-key"
```

### 4. First Encryption

```bash
# Encrypt your .env file
ripenv encrypt --env .env --project-id <your-project-id> --out ./encrypted

# Decrypt on another machine
ripenv decrypt --folder ./encrypted --project-id <your-project-id> --keyfile mykey.enc.json
```

## 🔒 Security Model & Threat Analysis

### **Cryptographic Guarantees**
- **Confidentiality**: XSalsa20-Poly1305 authenticated encryption
- **Integrity**: Built-in authentication tags prevent tampering
- **Forward Secrecy**: Ephemeral keys are rotated per encryption operation
- **Key Derivation**: Argon2id with tuned parameters resistant to GPU attacks

### **Trust Boundaries**
- **Client-side key generation**: Private keys never transmitted
- **Zero-knowledge architecture**: Server only stores encrypted data and public keys
- **Compartmentalized access**: Project-based isolation with granular permissions
- **Audit trail**: Comprehensive logging of all cryptographic operations

### **Threat Mitigation**
- ✅ **Insider threats**: Encrypted at rest with individual key wrapping
- ✅ **Supply chain attacks**: Cryptographic verification of all operations
- ✅ **Data breaches**: Zero plaintext exposure on server infrastructure
- ✅ **Credential theft**: Automatic rotation with configurable intervals
- ✅ **Social engineering**: Multi-factor authentication via email verification

## 📊 Usage Statistics & Impact

### **Supported Secret Types**
- API keys and tokens (AWS, GCP, Azure, etc.)
- Database connection strings
- OAuth credentials and refresh tokens
- Webhook URLs and signing secrets
- Certificate and private key materials
- Custom environment configurations

### **Enterprise Adoption**
- **Development Teams**: Secure collaboration on sensitive projects
- **CI/CD Pipelines**: Automated deployment with encrypted secrets
- **Compliance Requirements**: GDPR, SOC 2, and HIPAA compatible workflows
- **Multi-environment Management**: Separate encryption for dev/staging/prod

## 🔄 Rotation & Lifecycle Management

### **Automated Rotation Reminders**
- Configurable reminder intervals (30, 60, 90 days)
- Email notifications with project context
- Supabase Edge Functions for reliable delivery
- Team-wide coordination of rotation schedules

### **Secret Lifecycle**
1. **Generation**: Secure random key generation with proper entropy
2. **Distribution**: Encrypted individual wrapping for each team member
3. **Usage**: Decryption only on authorized developer machines
4. **Rotation**: Seamless key rotation with backward compatibility
5. **Revocation**: Immediate access removal for departing team members

## 🛠️ Advanced Configuration

### **Environment Variables**
```env
# Required
RIPENV_SUPABASE_URL=https://your-project.supabase.co
RIPENV_SUPABASE_ANON_KEY=your-anon-key

# Optional
GOOGLE_API_KEY=your-gemini-api-key  # For natural language commands
RIPENV_DEFAULT_KEYFILE=~/.ripenv/default.enc.json
```

### **Configuration File**
Create `~/.ripenv/config.env` for persistent settings:
```env
GOOGLE_API_KEY=your-gemini-api-key
DEFAULT_PROJECT_ID=your-default-project
ROTATION_REMINDER_DAYS=30
```

## 📁 Repository Structure

```
ripenv/
├── cli/                    # Python CLI application
│   ├── ripenv/            # Core CLI package
│   │   ├── main.py        # Click CLI entry point
│   │   ├── crypto.py      # Cryptographic operations
│   │   ├── keyfile.py     # Key management utilities
│   │   ├── manifest.py    # Manifest file handling
│   │   └── types.py       # Pydantic data models
│   ├── tests/             # CLI test suite
│   └── pyproject.toml     # Python packaging configuration
├── web/                   # Next.js dashboard
│   ├── app/               # App Router pages and API routes
│   ├── components/        # Reusable React components
│   ├── lib/               # Utility functions and configurations
│   └── package.json       # Node.js dependencies
├── supabase/              # Database schema and functions
│   ├── functions/         # Edge Functions for serverless operations
│   └── migrations/        # Database schema migrations
└── migrations/            # Additional schema updates
```

## 🤝 Contributing

We welcome contributions from the security and development community:

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** your changes (`git commit -m 'Add amazing feature'`)
4. **Push** to the branch (`git push origin feature/amazing-feature`)
5. **Open** a Pull Request

### **Development Setup**
- Follow the Quick Start guide for local development
- Run tests: `pytest` (CLI) and `npm test` (Web)
- Ensure all cryptographic operations maintain security guarantees
- Update documentation for new features

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🔗 Links & Resources

- **Documentation**: [Full Documentation](https://example.com/ripenv/docs)
- **Security Advisories**: [Security Policy](SECURITY.md)
- **API Reference**: [CLI Command Reference](https://example.com/ripenv/api)
- **Community**: [Discord Server](https://discord.gg/ripenv)

## ⚠️ Security Disclosure

If you discover a security vulnerability, please email security@ripenv.dev instead of using the issue tracker. All security vulnerabilities will be promptly addressed.

---

**ripenv** - *Git maintains your code. We protect your secrets.*
