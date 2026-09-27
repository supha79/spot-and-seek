import { Link } from 'react-router-dom';
import Button from '../components/ui/Button';

export default function NotFound() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-surface text-on-surface">
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-16 top-12 h-64 w-64 rounded-full bg-primary-fixed/40 blur-3xl" />
        <div className="absolute bottom-10 right-0 h-72 w-72 rounded-full bg-tertiary-fixed/30 blur-3xl" />
        <div className="absolute left-1/4 top-1/3 h-48 w-48 rounded-full bg-secondary-fixed/30 blur-3xl" />
      </div>

      <div className="flex min-h-screen items-center justify-center px-4 py-12">
        <div className="relative w-full max-w-[560px] rounded-[28px] bg-surface-container-lowest p-6 shadow-[0_20px_45px_rgba(0,102,136,0.12)] sm:p-10">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-tertiary-fixed px-4 py-1 text-label-sm text-on-tertiary-fixed shadow-[0_3px_0_#f2b6c8]">
            404 · OOPS!
          </div>

          <div className="mx-auto mb-6 flex h-48 w-48 items-center justify-center sm:h-56 sm:w-56">
            <div className="relative flex h-full w-full items-center justify-center rounded-full bg-surface-container">
              <div className="absolute inset-6 rounded-full border-[10px] border-primary-container/70 bg-surface-container-lowest" />
              <div className="absolute h-16 w-16 rounded-full border-[10px] border-primary-container/70 bg-surface-container-lowest" />
              <div className="absolute h-6 w-20 -rotate-[38deg] rounded-full bg-primary-container" style={{ transformOrigin: 'center', marginLeft: '42px', marginTop: '54px' }} />
              <div className="absolute left-1/2 top-1/2 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-primary-fixed text-2xl text-on-primary-fixed">
                ?
              </div>
            </div>
          </div>

          <div className="text-center">
            <h1 className="text-headline-lg text-on-surface">Page not found</h1>
            <p className="mt-2 text-headline-sm text-primary">ไม่พบหน้าที่คุณตามหา</p>
            <p className="mt-4 text-body-md text-on-surface-variant">
              หน้าที่คุณกำลังค้นหาอาจถูกย้าย ลบออก หรือพิมพ์ผิด ลองกลับไปหน้าหลักเพื่อเริ่มเล่นเกมใหม่ได้เลย
            </p>
          </div>

          <div className="mt-8 flex flex-col items-center gap-3">
            <Link to="/dashboard/home" className="w-full max-w-[280px]">
              <Button variant="primary" size="lg" leftIcon="home" className="w-full justify-center">
                Back to Home
              </Button>
            </Link>
            <Link to="/dashboard/play" className="text-label-lg text-secondary hover:text-on-secondary-container">
              หรือไปเลือกด่านเล่นเกม →
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
