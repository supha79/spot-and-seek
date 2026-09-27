import { Link } from 'react-router-dom';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';

const steps = [
  {
    index: '1',
    icon: 'visibility',
    title: 'Compare both pictures',
    subtitle: 'เปรียบเทียบสองภาพ',
    description: 'ดูภาพทั้งสองรูปแล้วหาจุดที่ไม่เหมือนกัน สังเกตความแตกต่างอย่างใจเย็นและช้าๆ',
    helper: 'มองหาจุดเล็กๆ เช่น สี ลวดลาย หรือสิ่งของที่หายไป',
    accent: 'bg-secondary-container text-on-secondary-container',
  },
  {
    index: '2',
    icon: 'touch_app',
    title: 'Tap the difference',
    subtitle: 'คลิกจุดที่ต่างกัน',
    description: 'คลิกที่จุดต่างในรูปใดรูปหนึ่ง หากถูกต้อง จะมีวงกลมสีเขียวน่ารักสว่างขึ้นแบบทันที',
    helper: '✓ จุดถูกต้อง (Correct Spot) วงกลมสีเขียวจะเชื่อมต่อทั้งสองฝั่งพร้อมกัน',
    accent: 'bg-primary-container text-on-primary-container',
  },
  {
    index: '3',
    icon: 'timer',
    title: 'Mind the time & use hints',
    subtitle: 'ใช้ตัวช่วยและระวังเวลา',
    description: 'ใช้ Hint ได้ 3 ครั้งต่อเกม และระวังเวลาที่กำลังนับถอยหลังเบาๆ พร้อมลุ้นความผ่อนคลายแบบไม่ตึงเครียด',
    helper: '💡 Hint จะช่วยวงจุดให้เห็นชัดเจนและทำให้การเล่นค่อยๆ คลายความกังวลลง',
    accent: 'bg-tertiary-fixed text-on-tertiary-fixed',
  },
];

export default function HowToPlay() {
  return (
    <div className="mx-auto max-w-5xl pb-10">
      <div className="rounded-[32px] border border-outline-variant/60 bg-surface-container-lowest p-5 shadow-[0_20px_50px_-12px_rgba(35,65,79,0.18)] sm:p-8">
        <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div className="space-y-3">
            <span className="inline-flex items-center gap-2 rounded-full bg-tertiary-fixed px-3 py-1 text-label-sm text-on-tertiary-fixed">
              <span className="material-symbols-outlined text-[16px] text-tertiary">school</span>
              Tutorial • วิธีการเล่น
            </span>

            <div>
              <h1 className="text-headline-lg text-on-surface md:text-display-hero-mobile">How to Play Spot &amp; Seek</h1>
              <p className="mt-2 text-body-md text-on-surface-variant">
                คู่มือการเล่นง่ายๆ ใน 3 ขั้นตอน • Relax and spot tiny cozy differences
              </p>
            </div>
          </div>

          <Link to="/dashboard/play">
            <Button variant="primary" size="lg" leftIcon="play_circle" className="w-full justify-center md:w-auto">
              Start playing
            </Button>
          </Link>
        </div>

        <div className="mt-8 grid gap-5 lg:grid-cols-3">
          {steps.map((step) => (
            <Card key={step.index} className="flex h-full flex-col p-5">
              <div className="flex items-center justify-between">
                <div className={`flex h-12 w-12 items-center justify-center rounded-full ${step.accent}`}>
                  <span className="material-symbols-outlined text-[24px]">{step.icon}</span>
                </div>
                <span className="rounded-full bg-surface-container px-2 py-1 text-label-sm text-on-surface-variant">
                  Step {step.index}
                </span>
              </div>

              <div className="mt-5 space-y-2 text-left">
                <h2 className="text-headline-md text-on-surface">{step.title}</h2>
                <p className="text-label-lg text-primary">{step.subtitle}</p>
                <p className="text-body-md text-on-surface-variant">{step.description}</p>
              </div>

              <div className="mt-auto pt-5">
                <div className="rounded-2xl bg-surface-container-low px-3 py-2 text-body-sm text-on-surface-variant">
                  {step.helper}
                </div>
              </div>
            </Card>
          ))}
        </div>

        <div className="mt-8 rounded-[28px] bg-gradient-to-r from-primary-fixed/50 via-surface-container-low to-secondary-fixed/50 p-5 shadow-[0_12px_28px_rgba(43,139,198,0.08)]">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-label-sm text-primary uppercase tracking-[0.2em]">Quick tip</div>
              <p className="mt-2 max-w-xl text-body-md text-on-surface-variant">
                เริ่มจากการเปรียบเทียบให้ช้าและละเอียดก่อนคลิก แล้วใช้ Hint ได้เมื่อเริ่มติดหรือตลกยากเกินไป
              </p>
            </div>

            <Link to="/dashboard/play">
              <Button variant="secondary" size="lg" leftIcon="sports_esports" className="w-full justify-center md:w-auto">
                Play now
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
