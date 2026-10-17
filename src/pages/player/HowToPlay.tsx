import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../../components/ui/Button';
import { BrandMascot } from '../../components/ui/BrandMascot';
import Modal from '../../components/ui/Modal';
import { useGameData } from '../../context/GameDataContext';
import { getPublishedGameplayAssetPreviewPairForLevel, type PublishedGameplayAssetPreviewPair } from '../../services/levelAssets';
import Home from './Home';

const steps = [
  {
    title: '1. Compare Both Pictures',
    subtitle: 'เปรียบเทียบสองภาพ',
    description: 'ดูภาพทั้งสองรูปแล้วหาจุดที่ไม่เหมือนกัน สังเกตความแตกต่างอย่างใจเย็น',
    helper: 'มองหาจุดเล็กๆ เช่น สี ลวดลาย หรือสิ่งของที่หายไป',
    icon: 'visibility',
  },
  {
    title: '2. Tap the Difference',
    subtitle: 'คลิกจุดที่ต่างกัน',
    description: 'คลิกที่จุดต่างในรูปใดรูปหนึ่ง ถ้าถูกต้องจะมีวงกลมสีเขียวสว่างขึ้นพร้อมกันทั้งสองรูป',
    helper: 'จุดถูกต้อง (Correct Spot) วงกลมสีเขียวจะเชื่อมต่อทั้งสองฝั่งทันที',
    icon: 'touch_app',
  },
  {
    title: '3. Mind the Time & Use Hints',
    subtitle: 'ใช้ตัวช่วยและระวังเวลา',
    description: 'ใช้ Hint ได้เมื่อเริ่มติด และคอยสังเกตเวลาที่เหลือระหว่างเล่น',
    helper: 'Hint จะช่วยวงจุดให้เห็นชัดเจน เล่นให้ทันเวลาแบบสบายๆ',
    icon: 'timer',
  },
];

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, '0');
  const remainingSeconds = (seconds % 60).toString().padStart(2, '0');
  return `${minutes}:${remainingSeconds}`;
}

export default function HowToPlay() {
  const navigate = useNavigate();
  const { levels } = useGameData();
  const [activeStep, setActiveStep] = useState(0);
  const [previewPair, setPreviewPair] = useState<PublishedGameplayAssetPreviewPair | null>(null);
  const homeBackdropRef = useRef<HTMLDivElement>(null);
  const previewLevel = levels.find((level) => level.title.toLowerCase().includes('bakery'))
    ?? levels.find((level) => level.difficulty === 'easy')
    ?? levels[0];
  const step = steps[activeStep];

  useEffect(() => {
    let isCurrent = true;
    setPreviewPair(null);
    if (previewLevel) {
      void getPublishedGameplayAssetPreviewPairForLevel(previewLevel.id)
        .then((pair) => {
          if (isCurrent) setPreviewPair(pair);
        })
        .catch(() => {
          if (isCurrent) setPreviewPair(null);
        });
    }
    return () => {
      isCurrent = false;
    };
  }, [previewLevel?.id]);

  useEffect(() => {
    const backdrop = homeBackdropRef.current;
    if (backdrop) backdrop.inert = true;
    return () => {
      if (backdrop) backdrop.inert = false;
    };
  }, []);

  const closeTutorial = () => navigate('/dashboard/home', { replace: true });
  const handleNext = () => {
    if (activeStep === steps.length - 1) {
      navigate('/dashboard/play');
      return;
    }
    setActiveStep((current) => current + 1);
  };

  return (
    <>
      <div ref={homeBackdropRef} aria-hidden="true" className="pointer-events-none select-none blur-[3px] opacity-70">
        <Home />
      </div>

      <Modal isOpen onClose={closeTutorial} className="max-w-2xl" size="lg">
        <section aria-labelledby="tutorial-title" className="max-h-[calc(100vh-2rem)] overflow-y-auto p-space-md sm:p-space-xl">
          <header className="flex items-start justify-between gap-space-md">
            <div className="min-w-0">
              <span className="inline-flex items-center gap-space-xs rounded-full bg-tertiary-fixed px-space-md py-1 text-label-sm font-bold uppercase text-on-tertiary-fixed">
                <span className="material-symbols-outlined text-[16px] text-tertiary" aria-hidden="true">school</span>
                Tutorial • วิธีการเล่น
              </span>
              <h1 id="tutorial-title" className="mt-space-sm text-headline-lg text-on-surface">How to Play Spot &amp; Seek</h1>
              <p className="mt-1 text-body-sm text-on-surface-variant sm:text-body-md">คู่มือการเล่นง่ายๆ ใน 3 ขั้นตอน • Relax and spot tiny cozy differences</p>
            </div>
            <button type="button" onClick={closeTutorial} aria-label="Close tutorial" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-container-low text-on-surface-variant shadow-[0_4px_0_#BFC8CE] transition-colors hover:bg-surface-container">
              <span className="material-symbols-outlined text-[22px]" aria-hidden="true">close</span>
            </button>
          </header>

          <div key={activeStep} role="group" aria-label={`Step ${activeStep + 1} of ${steps.length}`} aria-live="polite" className="ui-fade-in flex min-h-64 flex-col items-center justify-center gap-space-md py-space-md text-center sm:min-h-80">
            {activeStep < 2 ? (
              <div className="w-full rounded-md bg-surface-container-low/80 p-space-md sm:p-space-lg">
                <div className="relative mx-auto grid w-full max-w-md grid-cols-2 gap-space-md">
                  {[0, 1].map((pictureIndex) => (
                    <div key={pictureIndex} className="relative h-28 w-full overflow-hidden rounded-md bg-surface-container-lowest shadow-[0_4px_12px_rgba(43,139,198,0.06)] sm:h-36">
                      {previewPair && previewLevel ? (
                        <img
                          src={pictureIndex === 0 ? previewPair.original.signed_url : previewPair.comparison.signed_url}
                          alt={`${previewLevel.title} ${pictureIndex === 0 ? 'original' : 'difference'} image`}
                          loading="eager"
                          decoding="async"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full flex-col items-center justify-center gap-space-xs bg-surface-container text-center text-on-surface-variant">
                          <span className="material-symbols-outlined text-[36px]" aria-hidden="true">image</span>
                          {previewLevel ? <span className="text-label-sm">Loading {previewLevel.title}...</span> : null}
                        </div>
                      )}
                      {activeStep === 1 ? (
                        <div className="absolute left-1/2 top-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-secondary-fixed/90 text-on-secondary-fixed shadow-[0_3px_0_#2BA678]">
                          <span className="material-symbols-outlined text-[18px]" aria-hidden="true">check</span>
                        </div>
                      ) : null}
                      <span className={`absolute bottom-1.5 ${pictureIndex === 0 ? 'left-2' : 'right-2'} rounded-md bg-surface-container-lowest/90 px-1.5 py-0.5 text-label-sm text-on-surface-variant`}>
                        {pictureIndex === 0 ? 'Original' : 'Difference'}
                      </span>
                    </div>
                  ))}
                  {activeStep === 1 ? <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-tertiary-fixed px-space-sm py-0.5 text-label-sm text-on-tertiary-fixed">✦ Spot Synced!</span> : null}
                </div>
                <p className="mt-space-sm inline-flex items-center gap-space-xs text-label-sm text-primary">
                  <span className="material-symbols-outlined text-[18px]" aria-hidden="true">{step.icon}</span>
                  {activeStep === 0 ? 'Frame A vs B' : 'แตะรูปฝั่งไหนก็ได้ ระบบจะวงคู่ให้อัตโนมัติ'}
                </p>
              </div>
            ) : (
              <div className="flex w-full flex-col items-center gap-space-md rounded-md bg-surface-container-low/70 p-space-lg">
                <BrandMascot className="h-24 w-24" />
                <div className="flex flex-wrap justify-center gap-space-sm">
                  <span className="inline-flex items-center gap-1 rounded-full bg-tertiary-fixed px-space-md py-space-sm text-label-md text-on-tertiary-fixed">
                    <span className="material-symbols-outlined text-[18px]" aria-hidden="true">timer</span>
                    {previewLevel ? formatDuration(previewLevel.time) : '--:--'}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary-fixed px-space-md py-space-sm text-label-md text-on-primary-fixed-variant">
                    <span className="material-symbols-outlined text-[18px]" aria-hidden="true">lightbulb</span>
                    {previewLevel ? `${previewLevel.maxHints} Hints` : 'Hints'}
                  </span>
                </div>
              </div>
            )}

            <div className="flex max-w-lg flex-col items-center gap-space-xs">
              <h2 className="text-headline-md text-on-surface">{step.title}</h2>
              <p className="text-label-lg text-primary">{step.subtitle}</p>
              <p className="text-body-sm text-on-surface-variant sm:text-body-md">{step.description}</p>
              <div className="mt-space-xs inline-flex max-w-full items-center gap-space-xs rounded-full bg-secondary-container/70 px-space-md py-space-xs text-label-sm text-on-secondary-container">
                <span className="material-symbols-outlined shrink-0 text-[16px]" aria-hidden="true">{activeStep === 2 ? 'tips_and_updates' : 'check_circle'}</span>
                <span>{step.helper}</span>
              </div>
            </div>
          </div>

          <footer className="flex flex-col items-center justify-between gap-space-md pt-space-xs sm:flex-row">
            <button type="button" onClick={() => setActiveStep((current) => Math.max(0, current - 1))} disabled={activeStep === 0} className="order-2 rounded-full px-space-lg py-space-xs text-label-md text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface disabled:opacity-40 sm:order-1">
              Previous · ย้อนกลับ
            </button>
            <div role="tablist" aria-label="Tutorial steps" className="order-1 flex items-center gap-space-xs sm:order-2">
              {steps.map((item, index) => (
                <button key={item.title} type="button" role="tab" aria-label={`Step ${index + 1}`} aria-selected={index === activeStep} onClick={() => setActiveStep(index)} className={`transition-all ${index === activeStep ? 'h-3.5 w-8 rounded-full bg-primary-container shadow-[0_2px_0_#2B8BC6]' : `h-3 w-3 rounded-full ${index < activeStep ? 'bg-secondary-fixed-dim' : 'bg-surface-variant hover:scale-110'}`}`} />
              ))}
            </div>
            <div className="order-3 w-full sm:w-auto">
              <Button variant="primary" size="md" rightIcon={activeStep === steps.length - 1 ? 'play_arrow' : 'arrow_forward'} onClick={handleNext} className="w-full justify-center sm:w-auto">
                {activeStep === steps.length - 1 ? 'Start Playing · เริ่มเล่นเลย!' : 'Got it · เข้าใจแล้ว!'}
              </Button>
            </div>
          </footer>
        </section>
      </Modal>
    </>
  );
}