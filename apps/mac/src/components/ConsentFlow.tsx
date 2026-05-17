import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface ConsentState {
  partnerConsentGiven: boolean;
  partnerEmail?: string;
  partnerPhone?: string;
  consentDate?: Date;
  consentMethod?: 'email' | 'sms' | 'in-person';
}

export function ConsentFlow({
  onConsentComplete,
  onConsentRevoke,
  existingConsent,
}: {
  onConsentComplete: (consent: ConsentState) => void;
  onConsentRevoke: () => void;
  existingConsent?: ConsentState;
}) {
  const [step, setStep] = useState<'intro' | 'partner-info' | 'verification' | 'complete'>(
    existingConsent?.partnerConsentGiven ? 'complete' : 'intro'
  );
  const [partnerEmail, setPartnerEmail] = useState(existingConsent?.partnerEmail || '');
  const [partnerPhone, setPartnerPhone] = useState(existingConsent?.partnerPhone || '');
  const [consentMethod, setConsentMethod] = useState<'email' | 'sms'>('email');
  const [verificationCode, setVerificationCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState('');

  const handlePartnerInfoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!partnerEmail && !partnerPhone) {
      setError('Please provide either email or phone number');
      return;
    }
    setStep('verification');
    // In production, send verification code here
    const mockCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    console.log('Verification code (mock):', mockCode);
  };

  const handleVerification = (e: React.FormEvent) => {
    e.preventDefault();
    setIsVerifying(true);
    
    // In production, verify code with backend
    setTimeout(() => {
      setIsVerifying(false);
      const consent: ConsentState = {
        partnerConsentGiven: true,
        partnerEmail: partnerEmail || undefined,
        partnerPhone: partnerPhone || undefined,
        consentDate: new Date(),
        consentMethod,
      };
      onConsentComplete(consent);
      setStep('complete');
    }, 1000);
  };

  const handleRevoke = () => {
    if (confirm('Are you sure you want to revoke partner consent? This will immediately stop analyzing partner messages.')) {
      onConsentRevoke();
      setStep('intro');
    }
  };

  return (
    <div className="consent-flow">
      <AnimatePresence mode="wait">
        {step === 'intro' && (
          <motion.div
            key="intro"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="consent-intro"
          >
            <h2>Partner Message Analysis Consent</h2>
            <p>
              To analyze your relationship dynamics, we need your partner's consent to analyze their messages.
              This is required by our privacy policy and terms of service.
            </p>
            
            <div className="consent-details">
              <h3>What we analyze:</h3>
              <ul>
                <li>Communication patterns and frequency</li>
                <li>Emotional tone indicators</li>
                <li>Relationship dynamics</li>
                <li>Response times and engagement</li>
              </ul>
              
              <h3>What we don't analyze:</h3>
              <ul>
                <li>Specific message content (PII redacted)</li>
                <li>Private conversations unrelated to relationship</li>
                <li>Messages with sensitive content</li>
              </ul>
              
              <h3>Your partner's rights:</h3>
              <ul>
                <li>Can revoke consent at any time</li>
                <li>Can access their own data</li>
                <li>Can request deletion of their data</li>
                <li>Can contact us directly with concerns</li>
              </ul>
            </div>

            <button
              type="button"
              onClick={() => setStep('partner-info')}
              className="btn-primary"
            >
              Request Partner Consent
            </button>
          </motion.div>
        )}

        {step === 'partner-info' && (
          <motion.div
            key="partner-info"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="partner-info"
          >
            <h2>Partner Contact Information</h2>
            <p>
              Please provide your partner's contact information so we can send them a consent request.
            </p>
            
            <form onSubmit={handlePartnerInfoSubmit}>
              <div className="form-group">
                <label htmlFor="partnerEmail">Partner Email</label>
                <input
                  id="partnerEmail"
                  type="email"
                  value={partnerEmail}
                  onChange={(e) => setPartnerEmail(e.target.value)}
                  placeholder="partner@example.com"
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="partnerPhone">Partner Phone (optional)</label>
                <input
                  id="partnerPhone"
                  type="tel"
                  value={partnerPhone}
                  onChange={(e) => setPartnerPhone(e.target.value)}
                  placeholder="+1 (555) 123-4567"
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="consentMethod">Consent Method</label>
                <select
                  id="consentMethod"
                  value={consentMethod}
                  onChange={(e) => setConsentMethod(e.target.value as 'email' | 'sms')}
                >
                  <option value="email">Email</option>
                  <option value="sms">SMS</option>
                </select>
              </div>
              
              {error && <div className="error">{error}</div>}
              
              <div className="form-actions">
                <button
                  type="button"
                  onClick={() => setStep('intro')}
                  className="btn-secondary"
                >
                  Back
                </button>
                <button type="submit" className="btn-primary">
                  Send Consent Request
                </button>
              </div>
            </form>
          </motion.div>
        )}

        {step === 'verification' && (
          <motion.div
            key="verification"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="verification"
          >
            <h2>Verify Consent Code</h2>
            <p>
              We've sent a verification code to your partner via {consentMethod}.
              Please enter the code below to confirm their consent.
            </p>
            
            <form onSubmit={handleVerification}>
              <div className="form-group">
                <label htmlFor="verificationCode">Verification Code</label>
                <input
                  id="verificationCode"
                  type="text"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.toUpperCase())}
                  placeholder="ABC123"
                  maxLength={6}
                  style={{ textTransform: 'uppercase', letterSpacing: '0.5em' }}
                />
              </div>
              
              <div className="form-actions">
                <button
                  type="button"
                  onClick={() => setStep('partner-info')}
                  className="btn-secondary"
                >
                  Back
                </button>
                <button type="submit" className="btn-primary" disabled={isVerifying}>
                  {isVerifying ? 'Verifying...' : 'Verify Consent'}
                </button>
              </div>
            </form>
            
            <p className="resend-link">
              Didn't receive the code?{' '}
              <button type="button" className="link-button">
                Resend code
              </button>
            </p>
          </motion.div>
        )}

        {step === 'complete' && (
          <motion.div
            key="complete"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="consent-complete"
          >
            <div className="success-icon">✓</div>
            <h2>Partner Consent Confirmed</h2>
            <p>
              Your partner has consented to message analysis. We will now analyze their messages
              to provide relationship insights.
            </p>
            
            <div className="consent-summary">
              <p>
                <strong>Consent Date:</strong>{' '}
                {existingConsent?.consentDate?.toLocaleDateString()}
              </p>
              <p>
                <strong>Consent Method:</strong>{' '}
                {existingConsent?.consentMethod}
              </p>
              <p>
                <strong>Contact:</strong>{' '}
                {existingConsent?.partnerEmail || existingConsent?.partnerPhone}
              </p>
            </div>
            
            <div className="consent-actions">
              <button
                type="button"
                onClick={handleRevoke}
                className="btn-danger"
              >
                Revoke Consent
              </button>
              <button
                type="button"
                onClick={() => setStep('intro')}
                className="btn-secondary"
              >
                View Consent Details
              </button>
            </div>
            
            <p className="note">
              Your partner can revoke consent at any time by contacting us or through their own account.
              Consent revocation will immediately stop analysis of their messages.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
