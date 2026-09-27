import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Header } from '../../components/layout/Header';
import AmbientBackground from '../../components/ui/AmbientBackground';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Chip from '../../components/ui/Chip';
import Input from '../../components/ui/Input';
import { useAuth } from '../../context/AuthContext';

export default function Login() {
  const navigate = useNavigate();
  const { login, isLoading } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    try {
      await login(username, password);
      navigate('/dashboard/home');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed.';
      setError(message);
    }
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-surface text-on-surface">
      <AmbientBackground />

      <div className="relative z-10 mx-auto w-full max-w-[1200px] px-4 py-6 sm:px-8 sm:py-10">
        <Header>
          <Chip variant="secondary" icon="schedule">
            Daily Puzzle Ready!
          </Chip>
        </Header>

        <section className="relative flex w-full items-center justify-center py-6 sm:py-12">
          <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
            <div className="absolute -left-6 top-0 h-16 w-16 rounded-full bg-secondary-container/60 blur-sm" />
            <div className="absolute -right-2 top-8 h-12 w-12 rounded-full bg-tertiary-fixed/70 blur-sm" />
            <div className="absolute bottom-10 left-1/4 h-8 w-8 rounded-full bg-primary-fixed blur-sm" />
            <div className="absolute left-[10%] top-[30%] text-tertiary-container">
              <svg width="34" height="34" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 2l2.6 6.8L22 9.5l-5.4 4.8 1.6 7.2-6.2-3.8-6.2 3.8 1.6-7.2L2 9.5l7.4-.7L12 2z" />
              </svg>
            </div>
            <div className="absolute bottom-16 right-[10%] text-primary-container">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 0L14.5 9.5L24 12L14.5 14.5L12 24L9.5 14.5L0 12L9.5 9.5L12 0Z" />
              </svg>
            </div>
          </div>

          <aside className="hidden lg:flex lg:w-[220px] lg:flex-col lg:items-center lg:justify-center lg:gap-4">
            <Card className="w-[180px] rotate-[-6deg] p-3" size="sm">
              <div className="h-28 rounded-lg bg-gradient-to-br from-tertiary-fixed via-tertiary-container/40 to-surface-container" />
              <div className="mt-3 flex items-center justify-between">
                <span className="text-label-sm text-on-surface">Stage 12-A</span>
                <Chip variant="secondary">FOUND!</Chip>
              </div>
            </Card>
          </aside>

          <div className="relative w-full max-w-[470px]">
            <div className="relative mb-[-2rem] flex justify-center">
              <div className="flex h-28 w-28 items-center justify-center rounded-full bg-gradient-to-b from-primary-container to-primary-fixed p-2.5 shadow-md">
                <div className="flex h-full w-full items-center justify-center rounded-full bg-white">
                  <div className="flex flex-col items-center justify-center">
                    <div className="flex gap-3">
                      <span className="h-3.5 w-3.5 rounded-full bg-[#23414F]" />
                      <span className="h-3.5 w-3.5 rounded-full bg-[#23414F]" />
                    </div>
                    <div className="mt-1 h-2 w-8 rounded-b-full border-b-2 border-[#23414F]" />
                  </div>
                </div>
              </div>
            </div>

            <Card className="w-full overflow-hidden p-6 sm:p-10" size="lg" style={{ boxShadow: '0 20px 50px rgba(124, 200, 240, 0.22)' }}>
              <div className="mb-6 text-center">
                <h1 className="text-display-hero-mobile text-[#23414F]">Welcome back</h1>
                <p className="mt-2 text-body-sm text-on-surface-variant">
                  ยินดีต้อนรับกลับมา เข้าสู่ระบบเพื่อเล่นต่อได้เลย
                </p>
              </div>

              <form className="space-y-4" onSubmit={handleSubmit}>
                <div>
                  <label htmlFor="usernameInput" className="mb-2 block text-label-sm font-bold uppercase tracking-wider text-on-surface-variant">
                    Username
                  </label>
                  <Input
                    id="usernameInput"
                    leftIcon="search"
                    type="text"
                    placeholder="Seeker name or email..."
                    value={username}
                    onChange={setUsername}
                  />
                </div>

                <div>
                  <label htmlFor="passwordInput" className="mb-2 block text-label-sm font-bold uppercase tracking-wider text-on-surface-variant">
                    Password
                  </label>
                  <Input
                    id="passwordInput"
                    leftIcon="key"
                    type="password"
                    placeholder="Your secret passcode..."
                    value={password}
                    onChange={setPassword}
                  />
                </div>

                <div className="flex justify-end">
                  <Link to="/register" className="text-label-sm text-primary hover:text-on-primary-container">
                    Forgot password?
                  </Link>
                </div>

                {error ? <p className="text-sm text-error">{error}</p> : null}

                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  leftIcon="play_circle"
                  className="w-full"
                  disabled={isLoading}
                >
                  {isLoading ? 'Logging in...' : 'Log in'}
                </Button>
              </form>

              <div className="mt-6 text-center">
                <p className="text-body-sm text-on-surface-variant">
                  ยังไม่มีบัญชี?{' '}
                  <Link to="/register" className="ml-1 font-bold text-[#FF85A2] hover:text-[#e85b88]">
                    Sign up
                  </Link>
                </p>
              </div>
            </Card>
          </div>

          <aside className="hidden lg:flex lg:w-[220px] lg:flex-col lg:items-center lg:justify-center lg:gap-4">
            <Card className="w-[180px] rotate-[6deg] p-3" size="sm">
              <div className="h-28 rounded-lg bg-gradient-to-br from-primary-fixed via-primary-container/40 to-surface-container" />
              <div className="mt-3 flex items-center justify-between">
                <span className="text-label-sm text-on-surface">Difference</span>
                <span className="text-label-sm text-on-surface">4 / 5</span>
              </div>
            </Card>
          </aside>
        </section>
      </div>
    </main>
  );
}
