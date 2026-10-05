import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Header } from '../../components/layout/Header';
import AmbientBackground from '../../components/ui/AmbientBackground';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import { useAuth } from '../../context/AuthContext';

export default function ForgotPassword() {
  const { requestPasswordReset, isLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    try {
      await requestPasswordReset(email);
      setSent(true);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not send the recovery email.');
    }
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-surface text-on-surface">
      <AmbientBackground />
      <div className="relative z-10 mx-auto w-full max-w-[1200px] px-4 py-6 sm:px-8 sm:py-10">
        <Header />
        <section className="flex justify-center py-6 sm:py-12">
          <Card className="w-full max-w-[470px] p-6 sm:p-10" size="lg">
            <div className="mb-6 text-center">
              <h1 className="text-headline-md text-on-surface">Forgot password?</h1>
              <p className="mt-2 text-body-sm text-on-surface-variant">Enter your email and we will send a reset link.</p>
            </div>
            {sent ? (
              <p role="status" className="rounded-lg bg-secondary-container px-3 py-2 text-label-sm text-on-secondary-container">
                If an account exists for that email, a password reset link has been sent.
              </p>
            ) : (
              <form className="space-y-4" onSubmit={handleSubmit}>
                <label htmlFor="recovery-email" className="block text-label-sm font-bold uppercase text-on-surface-variant">
                  Email
                </label>
                <Input id="recovery-email" type="email" value={email} onChange={setEmail} placeholder="you@example.com" />
                {error ? <p role="alert" className="text-sm text-error">{error}</p> : null}
                <Button type="submit" size="lg" className="w-full" disabled={isLoading}>
                  {isLoading ? 'Sending...' : 'Send reset link'}
                </Button>
              </form>
            )}
            <div className="mt-6 text-center">
              <Link to="/login" className="text-label-md text-primary">Back to login</Link>
            </div>
          </Card>
        </section>
      </div>
    </main>
  );
}