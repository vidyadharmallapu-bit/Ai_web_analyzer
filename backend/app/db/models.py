from datetime import datetime, timezone
import uuid
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Float, Text, Boolean
from sqlalchemy.orm import relationship
from app.db.database import Base


def generate_uuid():
    return str(uuid.uuid4())


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=generate_uuid)
    email = Column(String, unique=True, index=True, nullable=False)
    full_name = Column(String, nullable=True)
    hashed_password = Column(String, nullable=True)
    avatar_url = Column(String, nullable=True)
    plan = Column(String, default="Free")  # Free, Pro, Business
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    subscriptions = relationship("Subscription", back_populates="user")
    payments = relationship("Payment", back_populates="user")
    invoices = relationship("Invoice", back_populates="user")
    scan_histories = relationship("ScanHistory", back_populates="user")
    oauth_accounts = relationship("OAuthAccount", back_populates="user", cascade="all, delete-orphan")


class OAuthAccount(Base):
    __tablename__ = "oauth_accounts"

    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    provider = Column(String, nullable=False)  # google, microsoft, x
    provider_user_id = Column(String, nullable=False)  # stable unique ID from provider (sub)
    provider_email = Column(String, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="oauth_accounts")

    __table_args__ = (
        # A user can only have one account per provider
        # But we'll handle this in application logic
    )


class Subscription(Base):
    __tablename__ = "subscriptions"

    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    plan = Column(String, nullable=False)       # Free, Pro, Business
    status = Column(String, default="active")   # active, cancelled, expired
    amount = Column(Float, default=0.0)
    billing_period = Column(String, default="monthly")  # monthly, yearly
    start_date = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    end_date = Column(DateTime, nullable=True)
    scan_limit = Column(Integer, default=5)     # Free=5, Pro=100, Business=500
    scans_used = Column(Integer, default=0)

    user = relationship("User", back_populates="subscriptions")


class Payment(Base):
    __tablename__ = "payments"

    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    razorpay_order_id = Column(String, unique=True, index=True, nullable=False)
    razorpay_payment_id = Column(String, nullable=True)
    razorpay_signature = Column(String, nullable=True)
    amount = Column(Float, nullable=False)       # in INR
    currency = Column(String, default="INR")
    status = Column(String, default="created")  # created, paid, failed, refunded
    plan = Column(String, nullable=False)
    billing_period = Column(String, default="monthly")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc),
                        onupdate=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="payments")
    transactions = relationship("Transaction", back_populates="payment")
    invoices = relationship("Invoice", back_populates="payment")


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(String, primary_key=True, default=generate_uuid)
    payment_id = Column(String, ForeignKey("payments.id"), nullable=False)
    transaction_type = Column(String, default="charge")  # charge, refund
    amount = Column(Float, nullable=False)
    status = Column(String, nullable=False)              # success, failure, pending
    gateway_response = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    payment = relationship("Payment", back_populates="transactions")


class Invoice(Base):
    __tablename__ = "invoices"

    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    payment_id = Column(String, ForeignKey("payments.id"), nullable=True)
    invoice_number = Column(String, unique=True, nullable=False)
    amount = Column(Float, nullable=False)
    plan_name = Column(String, nullable=False)
    pdf_url = Column(String, nullable=True)
    status = Column(String, default="paid")  # paid, pending, void
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="invoices")
    payment = relationship("Payment", back_populates="invoices")


class ScanHistory(Base):
    __tablename__ = "scan_histories"

    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    target = Column(String, nullable=False)
    score = Column(Integer, default=0)
    risk_level = Column(String, nullable=True)
    findings_count = Column(Integer, default=0)
    scan_mode = Column(String, default="passive")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="scan_histories")