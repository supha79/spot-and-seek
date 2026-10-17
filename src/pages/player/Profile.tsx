import { useGameData } from '../../context/GameDataContext';
import { useState } from 'react';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { BuddyAvatar } from '../../components/ui/BuddyAvatar';
import { useAuth } from '../../context/AuthContext';

export default function Profile() {
  const { profile, profileLoading, profileAvailable, profileError, selectedBuddy, setSelectedBuddy, buddyOptions } = useGameData();
  const { user, updateUsername, changePassword, isLoading } = useAuth();
  const [username, setUsername] = useState(user?.username ?? '');
  const [saveError, setSaveError] = useState('');
  const [saved, setSaved] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSaved, setPasswordSaved] = useState(false);
  const selectedBuddyOption = buddyOptions.find((buddy) => buddy.id === selectedBuddy) ?? buddyOptions[0];

  const handleUsernameSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaveError('');
    setSaved(false);
    try {
      await updateUsername(username);
      setSaved(true);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Could not update username.');
    }
  };

  const handlePasswordSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPasswordError('');
    setPasswordSaved(false);

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }

    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordSaved(true);
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : 'Could not change password.');
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-8">
      <section className="rounded-[28px] bg-surface-container-lowest p-6 shadow-[0_12px_28px_rgba(43,139,198,0.08)]">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            {profileLoading ? (
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-surface-container text-on-surface-variant">
                <span className="material-symbols-outlined text-[24px]" aria-hidden="true">person</span>
              </div>
            ) : (
              <BuddyAvatar emoji={selectedBuddyOption.emoji} accent={selectedBuddyOption.accent} size="xl" />
            )}
            <div>
              <div className="text-label-sm text-on-surface-variant uppercase tracking-[0.2em]">Profile</div>
              <h1 className="text-headline-lg text-on-surface">{user?.username || 'Player'}</h1>
              <p className="mt-1 text-body-sm text-on-surface-variant">{user?.email}</p>
            </div>
          </div>

          <div className="rounded-full bg-secondary-container px-4 py-2 text-label-md text-on-secondary-container">Casual play</div>
        </div>
      </section>

      <section className="grid gap-5 md:grid-cols-2">
        {profileError ? <p role="alert" className="md:col-span-2 text-sm text-error">{profileError}</p> : null}
        <div className="rounded-[28px] bg-surface-container-lowest p-6 shadow-[0_12px_28px_rgba(43,139,198,0.08)]">
          <h2 className="text-headline-md text-on-surface">Account</h2>
          <form className="mt-4 grid gap-4" onSubmit={handleUsernameSubmit}>
            <div>
              <label htmlFor="profile-email" className="mb-2 block text-label-sm text-on-surface-variant">Email</label>
              <Input id="profile-email" type="email" value={user?.email ?? ''} disabled />
            </div>
            <div>
              <label htmlFor="profile-username" className="mb-2 block text-label-sm text-on-surface-variant">Username</label>
              <Input id="profile-username" value={username} onChange={setUsername} />
            </div>
            <Button type="submit" disabled={isLoading}>{isLoading ? 'Saving...' : 'Save username'}</Button>
          </form>
          {saveError ? <p role="alert" className="mt-3 text-sm text-error">{saveError}</p> : null}
          {saved ? <p role="status" className="mt-3 text-sm text-secondary">Username updated.</p> : null}
        </div>
        <section className="rounded-[28px] bg-surface-container-lowest p-6 shadow-[0_12px_28px_rgba(43,139,198,0.08)]">
          <div className="mb-5 flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-tertiary-fixed text-on-tertiary-fixed shadow-[0_4px_0_#f2b6c8]">
              <span className="material-symbols-outlined text-[24px]">vpn_key</span>
            </div>
            <div>
              <h2 className="text-headline-sm text-on-surface">Change password</h2>
              <p className="text-body-sm text-on-surface-variant">เปลี่ยนรหัสผ่านเพื่อความปลอดภัยของบัญชี</p>
            </div>
          </div>

          <form className="flex flex-col gap-4" onSubmit={handlePasswordSubmit}>
            <div>
              <label htmlFor="current-password" className="mb-2 flex justify-between text-label-md text-on-surface">
                <span>Current password</span>
                <span className="text-body-sm text-outline">รหัสเดิม</span>
              </label>
              <Input id="current-password" type="password" value={currentPassword} onChange={setCurrentPassword} placeholder="Current password" />
            </div>
            <div>
              <label htmlFor="new-password" className="mb-2 flex justify-between text-label-md text-on-surface">
                <span>New password</span>
                <span className="text-body-sm text-outline">รหัสใหม่</span>
              </label>
              <Input id="new-password" type="password" value={newPassword} onChange={setNewPassword} placeholder="New password" />
            </div>
            <div>
              <label htmlFor="confirm-new-password" className="mb-2 flex justify-between text-label-md text-on-surface">
                <span>Confirm new password</span>
                <span className="text-body-sm text-outline">ยืนยันรหัสใหม่อีกครั้ง</span>
              </label>
              <Input id="confirm-new-password" type="password" value={confirmPassword} onChange={setConfirmPassword} placeholder="Confirm new password" />
            </div>

            <div className="flex items-start gap-2 rounded-2xl bg-surface-container-low p-4 text-body-sm text-on-surface-variant">
              <span className="material-symbols-outlined shrink-0 text-[20px] text-secondary">info</span>
              <p>รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร และประกอบด้วยตัวอักษรภาษาอังกฤษพร้อมตัวเลขอย่างน้อยหนึ่งตัว</p>
            </div>

            {passwordError ? <p role="alert" className="text-sm text-error">{passwordError}</p> : null}
            {passwordSaved ? <p role="status" className="text-sm text-secondary">เปลี่ยนรหัสผ่านสำเร็จแล้ว</p> : null}
            <Button type="submit" size="lg" className="w-full" disabled={isLoading} rightIcon="arrow_forward">
              {isLoading ? 'Saving...' : 'Save changes'}
            </Button>
          </form>
          <p className="mt-5 flex items-center justify-center gap-2 text-center text-body-sm text-on-surface-variant">
            <span className="material-symbols-outlined text-[16px] text-secondary">verified_user</span>
            ข้อมูลความปลอดภัยถูกเข้ารหัสตามมาตรฐาน Spot &amp; Seek
          </p>
        </section>

        <div className="rounded-[28px] bg-surface-container-lowest p-6 shadow-[0_12px_28px_rgba(43,139,198,0.08)]">
          <h2 className="text-headline-md text-on-surface">Current buddy</h2>
          <div className="mt-4 flex items-center gap-4 rounded-2xl bg-surface-container-low p-4">
            {profileLoading ? (
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-surface-container text-on-surface-variant">
                <span className="material-symbols-outlined text-[20px]" aria-hidden="true">person</span>
              </div>
            ) : (
              <BuddyAvatar emoji={selectedBuddyOption.emoji} accent={selectedBuddyOption.accent} size="lg" decorative />
            )}
            <div>
              <div className="text-headline-sm text-on-surface">{profileLoading ? 'Loading...' : selectedBuddy}</div>
              <div className="text-body-sm text-on-surface-variant">Your companion is ready to help you spot details.</div>
            </div>
          </div>
        </div>

        <div className="rounded-[28px] bg-surface-container-lowest p-6 shadow-[0_12px_28px_rgba(43,139,198,0.08)]">
          <h2 className="text-headline-md text-on-surface">Stats</h2>
          {profileAvailable && !profileLoading && profile.totalPlays === 0 ? (
            <p className="mt-4 text-body-sm text-on-surface-variant">No game history yet</p>
          ) : (
            <div className="mt-4 grid grid-cols-2 gap-3 text-left">
              <div className="rounded-2xl bg-surface-container-low p-3">
                <div className="text-label-sm text-on-surface-variant">Best score</div>
                <div className="mt-1 text-headline-sm text-on-surface">{profileLoading ? '...' : profileAvailable ? profile.bestScore.toLocaleString() : '—'}</div>
              </div>
              <div className="rounded-2xl bg-surface-container-low p-3">
                <div className="text-label-sm text-on-surface-variant">Play count</div>
                <div className="mt-1 text-headline-sm text-on-surface">{profileLoading ? '...' : profileAvailable ? profile.totalPlays : '—'}</div>
              </div>
              <div className="rounded-2xl bg-surface-container-low p-3">
                <div className="text-label-sm text-on-surface-variant">Avg. time</div>
                <div className="mt-1 text-headline-sm text-on-surface">{profileLoading ? '...' : profileAvailable ? `${profile.avgTime}s` : '—'}</div>
              </div>
              <div className="rounded-2xl bg-surface-container-low p-3">
                <div className="text-label-sm text-on-surface-variant">Stages</div>
                <div className="mt-1 text-headline-sm text-on-surface">{profileLoading ? '...' : profileAvailable ? `${profile.levelsCompleted}/${profile.totalLevels}` : '—'}</div>
              </div>
            </div>
          )}
          {profile.statsNotice ? <p role="status" className="mt-4 text-body-sm text-on-surface-variant">{profile.statsNotice}</p> : null}
        </div>
      </section>

      <section className="rounded-[28px] bg-surface-container-lowest p-6 shadow-[0_12px_28px_rgba(43,139,198,0.08)]">
        <h2 className="text-headline-md text-on-surface">Choose buddy</h2>
        <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {buddyOptions.map((buddy) => (
            <button
              key={buddy.id}
              type="button"
              onClick={() => setSelectedBuddy(buddy.id)}
              disabled={profileLoading}
              className={`ui-pressable flex flex-col items-center gap-2 rounded-2xl border p-4 text-center transition-all disabled:cursor-wait disabled:opacity-60 ${!profileLoading && selectedBuddy === buddy.id ? 'border-primary bg-primary-fixed/40 shadow-[0_8px_24px_rgba(124,200,240,0.35)]' : 'border-transparent bg-surface-container-low hover:border-outline-variant'}`}
            >
              <BuddyAvatar emoji={buddy.emoji} accent={buddy.accent} size="lg" decorative />
              <span className="text-label-md text-on-surface">{buddy.name}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
