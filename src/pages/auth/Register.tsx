import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Header } from '../../components/layout/Header';
import AmbientBackground from '../../components/ui/AmbientBackground';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Chip from '../../components/ui/Chip';
import Input from '../../components/ui/Input';
import { useAuth } from '../../context/AuthContext';

export default function Register() {
  const navigate = useNavigate();
  const { register, isLoading, configError } = useAuth();

  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [registrationSent, setRegistrationSent] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    if (!email.trim()) {
      setError('Email is required.');
      return;
    }

    if (!username.trim()) {
      setError('Username is required.');
      return;
    }

    if (!password) {
      setError('Password is required.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    try {
      await register(email, username, password, confirmPassword);
      setRegistrationSent(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Registration failed.';
      setError(message);
    }
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-surface text-on-surface">
      <AmbientBackground />

      <div className="relative z-10 mx-auto w-full max-w-[1200px] px-4 py-6 sm:px-8 sm:py-10">
        <Header>
          <Chip variant="secondary" icon="rocket_launch">
            Free to Play · No Ads
          </Chip>
        </Header>

        <section className="relative flex w-full items-center justify-center py-6 sm:py-12">
          <div className="relative w-full max-w-[480px]">
            <Card className="w-full overflow-hidden p-6 sm:p-10" size="lg" style={{ boxShadow: '0 20px 45px -10px rgba(124, 200, 240, 0.28)' }}>
              <div className="mb-6 text-center">
                <h1 className="text-headline-md text-on-surface">Create your account</h1>
                <p className="mt-2 text-body-sm text-on-surface-variant">สมัครสมาชิกใช้เวลาไม่ถึงหนึ่งนาที</p>
              </div>

              {registrationSent ? (
                <div role="status" className="mb-4 space-y-3 rounded-lg bg-secondary-container px-3 py-2 text-label-sm text-on-secondary-container">
                  <p>Check your inbox and confirm your email before logging in.</p>
                  <Button variant="ghost" onClick={() => navigate('/login')}>Go to login</Button>
                </div>
              ) : null}

              <form className="space-y-4" onSubmit={handleSubmit}>
                <div>
                  <div className="mb-2 flex items-center justify-between px-1">
                    <label htmlFor="reg-email" className="text-label-sm font-bold uppercase tracking-wider text-on-surface-variant">
                      Email
                    </label>
                  </div>
                  <Input
                    id="reg-email"
                    type="email"
                    value={email}
                    onChange={setEmail}
                    placeholder="you@example.com"
                  />
                </div>
                <div>
                  <div className="mb-2 flex items-center justify-between px-1">
                    <label htmlFor="reg-username" className="text-label-sm font-bold uppercase tracking-wider text-on-surface-variant">
                      Username
                    </label>
                    <span className="text-xs text-on-surface-variant/70">Profile name</span>
                  </div>
                  <div className={`relative ${error ? 'rounded-lg border border-error bg-[#FFE8EF]' : ''}`}>
                    <Input
                      id="reg-username"
                      type="text"
                      value={username}
                      onChange={setUsername}
                      placeholder="seeker_sam"
                      className={error ? 'border border-error bg-[#FFE8EF] text-error' : ''}
                    />
                  </div>
                  {error || configError ? (
                    <div className="mt-2 flex items-center gap-2 rounded-lg bg-[#FFE8EF] px-3 py-2 text-error">
                      <span className="material-symbols-outlined text-base">info</span>
                      <span className="text-label-sm font-semibold">{error || configError}</span>
                    </div>
                  ) : null}
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between px-1">
                    <label htmlFor="reg-password" className="text-label-sm font-bold uppercase tracking-wider text-on-surface-variant">
                      Password
                    </label>
                  </div>
                  <Input id="reg-password" type="password" value={password} onChange={setPassword} placeholder="••••••••" />
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between px-1">
                    <label htmlFor="reg-confirm-password" className="text-label-sm font-bold uppercase tracking-wider text-on-surface-variant">
                      Confirm Password
                    </label>
                  </div>
                  <Input id="reg-confirm-password" type="password" value={confirmPassword} onChange={setConfirmPassword} placeholder="Re-enter your password" />
                </div>

                <Button type="submit" variant="primary" size="lg" className="w-full" leftIcon="celebration" disabled={isLoading}>
                  {isLoading ? 'Creating account...' : 'Create account'}
                </Button>
              </form>

              <div className="mt-6 text-center">
                <span className="text-body-md text-on-surface-variant">มีบัญชีอยู่แล้ว? </span>
                <Link to="/login" className="ml-1 font-bold text-[#FF85A2] hover:text-[#e85b88]">
                  Log in
                </Link>
              </div>
            </Card>
          </div>
        </section>
      </div>
    </main>
  );
}
