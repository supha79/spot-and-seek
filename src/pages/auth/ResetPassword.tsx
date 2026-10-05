import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Header } from '../../components/layout/Header';
import AmbientBackground from '../../components/ui/AmbientBackground';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Input from '../../components/ui/Input';
import { useAuth } from '../../context/AuthContext';

export default function ResetPassword() {
  const { isLoading, isRecoverySession, updatePassword } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [complete, setComplete] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    try {
      await updatePassword(password);
      setComplete(true);
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : 'Could not update the password.');
    }
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-surface text-on-surface">
      <AmbientBackground />
      <div className="relative z-10 mx-auto w-full max-w-[1200px] px-4 py-6 sm:px-8 sm:py-10">
        <Header />
        <section className="flex justify-center py-6 sm:py-12">
          <Card className="w-full max-w-[470px] p-6 sm:p-10" size="lg">
            {complete ? (
              <div className="text-center">
                <h1 className="text-headline-md text-on-surface">Password updated</h1>
                <p role="status" className="mt-3 text-body-sm text-on-surface-variant">Your password has been changed.</p>
                <Link to="/login" className="mt-6 inline-block text-label-md text-primary">Continue to login</Link>
              </div>
            ) : isLoading ? (
              <p role="status" className="text-center text-body-md text-on-surface-variant">Checking reset link...</p>
            ) : !isRecoverySession ? (
              <div className="text-center">
                <h1 className="text-headline-md text-on-surface">Reset link unavailable</h1>
                <p role="alert" className="mt-3 text-body-sm text-on-surface-variant">This reset link is invalid or has expired.</p>
                <Link to="/forgot-password" className="mt-6 inline-block text-label-md text-primary">Request another link</Link>
              </div>
            ) : (
              <>
                <div className="mb-6 text-center">
                  <h1 className="text-headline-md text-on-surface">Choose a new password</h1>
                  <p className="mt-2 text-body-sm text-on-surface-variant">Enter and confirm your new password.</p>
                </div>
                <form className="space-y-4" onSubmit={handleSubmit}>
                  <label htmlFor="new-password" className="block text-label-sm font-bold uppercase text-on-surface-variant">
                    New password
                  </label>
                  <Input id="new-password" type="password" value={password} onChange={setPassword} placeholder="New password" />
                  <label htmlFor="confirm-new-password" className="block text-label-sm font-bold uppercase text-on-surface-variant">
                    Confirm password
                  </label>
                  <Input id="confirm-new-password" type="password" value={confirmPassword} onChange={setConfirmPassword} placeholder="Confirm new password" />
                  {error ? <p role="alert" className="text-sm text-error">{error}</p> : null}
                  <Button type="submit" size="lg" className="w-full" disabled={isLoading}>
                    {isLoading ? 'Updating...' : 'Update password'}
                  </Button>
                </form>
              </>
            )}
          </Card>
        </section>
      </div>
    </main>
  );
}