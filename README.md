# CyberShield AI — Website Security Analyzer & PhonePe Payment Integration

CyberShield AI is an enterprise-grade website security analyzer and vulnerability scanner featuring real subscription management and secure payment processing via the official **PhonePe Payment Gateway**.

---

## Features

- **Website Security Scanning**: Comprehensive vulnerability assessment including SSL/TLS analysis, port scanning, DNS enumeration, and technology detection
- **Vulnerability Detection**: Identifies security issues like exposed ports, outdated software, misconfigurations, and known CVEs
- **PhonePe Payment Integration**: Secure payment processing for subscription plans (Pro, Business) via PhonePe Standard Checkout API
- **Subscription Management**: Tiered plans (Free, Pro, Business) with feature gating based on subscription status
- **Real-time Payment Flow**: QR code generation, payment polling, and instant plan unlocking upon successful payment
- **Webhook Handling**: Secure, idempotent webhook processing with cryptographic verification
- **Multi-factor Authentication**: OAuth 2.0 support for Google, Microsoft, and X (Twitter)
- **PDF Reports**: Generate detailed security assessment reports

---

## Technologies Used

### Backend
- **FastAPI** - Modern, fast web framework for building APIs
- **Uvicorn** - ASGI server for running FastAPI applications
- **SQLAlchemy** - ORM for database operations
- **Pydantic** - Data validation and serialization
- **httpx/requests** - HTTP clients for external API calls
- **dnspython** - DNS querying and enumeration
- **python-nmap** - Network port scanning
- **wappalyzer** - Technology stack detection
- **PhonePe SDK** - Payment gateway integration
- **python-dotenv** - Environment variable management

### Frontend
- **React 18** - UI library
- **Vite** - Build tool and dev server
- **Tailwind CSS** - Utility-first CSS framework
- **Framer Motion** - Animation library
- **Chart.js** - Data visualization
- **jsPDF** - PDF report generation
- **Lucide React** - Icon library
- **Axios** - HTTP client

### Infrastructure
- **Docker** - Containerization
- **Docker Compose** - Multi-container orchestration
- **SQLite** (development) / **PostgreSQL** (production) - Database

---

## Project Structure

```
web_analyzer/
├── backend/
│   ├── app/
│   │   ├── auth/           # Authentication routes & logic
│   │   ├── db/             # Database models & connection
│   │   ├── services/       # Core business logic
│   │   │   ├── scanner.py      # Website scanning logic
│   │   │   ├── security_checker.py  # Vulnerability checks
│   │   │   └── payment_service.py   # PhonePe payment handling
│   │   ├── main.py         # FastAPI application entry point
│   │   └── __init__.py
│   ├── payments/
│   │   ├── phonepe.py      # PhonePe API client
│   │   ├── routes.py       # Payment API endpoints
│   │   └── webhook.py      # Webhook handler
│   ├── requirements.txt    # Python dependencies
│   └── .env.example        # Environment template
├── frontend/
│   ├── src/
│   │   ├── pages/          # React page components
│   │   │   ├── Dashboard.jsx
│   │   │   ├── Landing.jsx
│   │   │   ├── Login.jsx
│   │   │   ├── ScanPage.jsx
│   │   │   ├── PaymentPage.jsx
│   │   │   ├── PaymentsHistory.jsx
│   │   │   └── History.jsx
│   │   ├── App.jsx         # Main app component
│   │   ├── main.jsx        # Entry point
│   │   └── index.css       # Global styles
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.cjs
│   └── postcss.config.cjs
├── tests/
│   ├── test_scanner.py
│   └── test_payment.py
├── docker-compose.yml
├── Dockerfile
├── package.json            # Root package.json for dev scripts
└── README.md
```

---

## Installation

### Prerequisites
- Python 3.11+
- Node.js 18+
- Docker & Docker Compose (optional, for containerized deployment)

### Backend Setup

```bash
# Navigate to backend
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Copy environment template and configure
cp .env.example .env
# Edit .env with your credentials
```

### Frontend Setup

```bash
# Navigate to frontend
cd frontend

# Install dependencies
npm install
```

---

## Running the Project Locally

### Option 1: Docker Compose (Recommended)

```bash
# Build and start all services
docker-compose up --build

# Backend: http://localhost:8000
# Frontend: http://localhost:5173
```

### Option 2: Manual Development Mode

**Terminal 1 - Backend:**
```bash
cd backend
source venv/bin/activate  # On Windows: venv\Scripts\activate
$env:PYTHONPATH="backend"  # On Linux/Mac: export PYTHONPATH=backend
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

### Running Tests

```bash
cd backend
$env:PYTHONPATH="backend"  # On Linux/Mac: export PYTHONPATH=backend
python -m pytest tests/ -v
```

---

## Environment Variables

### Backend (.env)

Copy `backend/.env.example` to `backend/.env` and configure:

| Variable | Description | Required |
|----------|-------------|----------|
| `PHONEPE_MERCHANT_ID` | PhonePe Merchant ID from Merchant Portal | Yes (for payments) |
| `PHONEPE_SALT_KEY` | PhonePe Salt Key for checksum generation | Yes (for payments) |
| `PHONEPE_SALT_INDEX` | PhonePe Salt Index | Yes (for payments) |
| `PHONEPE_ENV` | `uat` (test) or `production` | Yes (for payments) |
| `PAYMENT_MODE` | `test` or `live` | Yes (for payments) |
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID | No |
| `GOOGLE_CLIENT_SECRET` | Google OAuth Client Secret | No |
| `MICROSOFT_CLIENT_ID` | Microsoft OAuth Client ID | No |
| `MICROSOFT_CLIENT_SECRET` | Microsoft OAuth Client Secret | No |
| `MICROSOFT_TENANT_ID` | Microsoft Tenant ID (default: `common`) | No |
| `X_CLIENT_ID` | X (Twitter) OAuth Client ID | No |
| `X_CLIENT_SECRET` | X (Twitter) OAuth Client Secret | No |
| `SESSION_SECRET` | Random secret for session encryption | Yes |
| `FRONTEND_URL` | Frontend URL for CORS (default: `http://localhost:5173`) | No |
| `BACKEND_URL` | Backend URL (default: `http://localhost:8000`) | No |
| `DATABASE_URL` | Database connection string (default: `sqlite:///./cybershield.db`) | No |

---

## How to Use the Application

### 1. Website Security Scan
1. Open the application at `http://localhost:5173`
2. Navigate to **Scan** page
3. Enter a target URL (e.g., `https://example.com`)
4. Click **Start Scan**
5. View results including:
   - SSL/TLS certificate details
   - Open ports and services
   - DNS records
   - Detected technologies (CMS, frameworks, etc.)
   - Vulnerability findings with severity ratings

### 2. Subscription & Payment
1. Navigate to **Pricing** or **Dashboard**
2. Select **Pro** or **Business** plan
3. Click **Subscribe** - backend creates PhonePe payment order
4. Scan QR code with PhonePe/UPI app or click **Pay via PhonePe**
5. Payment status polls automatically every 3 seconds
6. Upon success, plan features unlock instantly

### 3. View Reports
- **Dashboard**: Overview of scans and subscription status
- **History**: Past scan results
- **Payments History**: Transaction records
- **PDF Export**: Generate detailed reports from scan results

---

## API Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Get current user

### Scanning
- `POST /api/scan` - Initiate website scan
- `GET /api/scan/{scan_id}` - Get scan results
- `GET /api/scans` - List user's scans

### Payments
- `POST /api/payments/create-order` - Create PhonePe payment order
- `GET /api/payments/status/{order_id}` - Check payment status
- `POST /api/payments/verify` - Verify payment with PhonePe
- `POST /api/payments/phonepe/callback` - PhonePe webhook endpoint

### Subscription
- `GET /api/subscription/current` - Get current subscription
- `GET /api/subscription/plans` - List available plans

---

## PhonePe Integration Details

### Test Mode Setup
```env
PHONEPE_ENV=uat
PHONEPE_MERCHANT_ID=PGTESTPAYUAT
PHONEPE_SALT_KEY=099eb0cd-02cf-4e2a-8aca-3e6c6aff0399
PHONEPE_SALT_INDEX=1
PAYMENT_MODE=test
```

### Production Setup
1. Register on [PhonePe Business Portal](https://www.phonepe.com/)
2. Obtain live Merchant ID, Salt Key, Salt Index
3. Configure webhook URL: `https://your-domain.com/api/payments/phonepe/callback`
4. Set `PHONEPE_ENV=production` and `PAYMENT_MODE=live`

---

## Security Considerations

- **Never commit `.env` files** - They are in `.gitignore`
- **Server-side price validation** - All amounts calculated on backend
- **Idempotent webhooks** - Prevents duplicate processing
- **Cryptographic verification** - SHA256 checksums on all PhonePe callbacks
- **HTTPS required in production** - For secure webhook delivery

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## Support

For issues and feature requests, please open a GitHub issue.