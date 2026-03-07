'use client'

import {
  GraduationCap,
  User,
  Mail,
  Phone,
  Github,
  BookOpen,
  Cpu,
  Brain,
  Leaf,
  Building2,
  Calendar,
  ExternalLink,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const PROJECT_INFO = {
  title: 'ระบบติดตามและพยากรณ์สภาพแวดล้อมห้องเก็บยาสมุนไพร',
  titleEn: 'IoT-Based Herbal Storage Environmental Monitoring & Prediction System',
  year: '2568', // ปีการศึกษา — แก้ไขได้
  university: 'มหาวิทยาลัยเทคโนโลยีพระจอมเกล้าพระนครเหนือ', // TODO: เปลี่ยนเป็นชื่อมหาวิทยาลัย
  faculty: 'คณะเทคโนโลยีและการจัดการอุตสาหกรรม สาขาวิชาเทคโนโลยีสารสนเทศ ', // TODO: เปลี่ยน
  advisor: 'ผู้ช่วยศาสตราจารย์ ดร.นัฎฐพันธ์ นาคพงษ', // TODO: เปลี่ยน
  description:
    'โปรเจคนี้เป็นส่วนหนึ่งของการศึกษาระดับปริญญาตรี พัฒนาระบบ IoT สำหรับติดตามอุณหภูมิและความชื้นภายในห้องเก็บยาสมุนไพรแบบเรียลไทม์ พร้อมด้วยการวิเคราะห์ข้อมูลและพยากรณ์แนวโน้มด้วย Machine Learning',
}

const AUTHOR_INFO = {
  name: 'นายสุชาพุฒิ ประณีตทอง และ นางสาวธนิตชา  จินดารา ', // TODO: เปลี่ยน
  studentId: '6506021620202 และ 6506021620121', // TODO: เปลี่ยน
  email: 's6506021620202@email.kmutnb.ac.th', // TODO: เปลี่ยน
  phone: '0659094903', // TODO: เปลี่ยน หรือลบออก
  github: 'https://github.com/suchaphut', // TODO: เปลี่ยน หรือลบออก
  linkedin: '', // TODO: ใส่ลิงก์ LinkedIn หรือเว็บไซต์ส่วนตัว (ถ้ามี)
}

const TECH_STACK = [
  { category: 'Frontend', items: ['Next.js 15', 'React 19', 'TypeScript', 'Tailwind CSS', 'shadcn/ui'] },
  { category: 'Backend', items: ['Next.js API Routes', 'MongoDB', 'Mongoose', 'JWT Auth'] },
  { category: 'Hardware', items: ['ESP32', 'DHT22 (Temp/Humidity)', 'SCT-013 (Power)'] },
  { category: 'Machine Learning', items: ['Holt-Winters', 'Isolation Forest', 'Z-Score', 'Prophet (Python)'] },
]

const FEATURES = [
  { icon: Leaf, label: 'ติดตามห้องเก็บยาสมุนไพรแบบเรียลไทม์' },
  { icon: Cpu, label: 'รับข้อมูลจาก ESP32 + DHT22 ผ่าน MQTT/HTTP' },
  { icon: Brain, label: 'พยากรณ์อุณหภูมิและความชื้นด้วย ML' },
  { icon: Building2, label: 'จัดการหลายห้องและหลายเซ็นเซอร์' },
]

export function AboutPanel() {
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h2 className="text-2xl font-bold text-foreground">เกี่ยวกับโปรเจค</h2>
        <p className="text-sm text-muted-foreground">ข้อมูลโปรเจคปริญญานิพนธ์และผู้พัฒนา</p>
      </div>

      {/* Project card */}
      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-600/10 text-emerald-600">
              <GraduationCap className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <CardTitle className="text-base leading-snug">{PROJECT_INFO.title}</CardTitle>
              <p className="text-xs text-muted-foreground">{PROJECT_INFO.titleEn}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground leading-relaxed">{PROJECT_INFO.description}</p>

          <div className="grid gap-3 sm:grid-cols-2">
            <InfoRow icon={Building2} label="มหาวิทยาลัย" value={PROJECT_INFO.university} />
            <InfoRow icon={BookOpen} label="คณะ / สาขา" value={PROJECT_INFO.faculty} />
            <InfoRow icon={User} label="อาจารย์ที่ปรึกษา" value={PROJECT_INFO.advisor} />
            <InfoRow icon={Calendar} label="ปีการศึกษา" value={PROJECT_INFO.year} />
          </div>
        </CardContent>
      </Card>

      {/* Author card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-600/10 text-blue-600">
              <User className="h-5 w-5" />
            </div>
            <CardTitle className="text-base">ผู้พัฒนา</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <InfoRow icon={User} label="ชื่อ-นามสกุล" value={AUTHOR_INFO.name} />
          <InfoRow icon={BookOpen} label="รหัสนักศึกษา" value={AUTHOR_INFO.studentId} />

          <div className="pt-1 border-t border-border/50">
            <p className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">ติดต่อ</p>
            <div className="space-y-2">
              {AUTHOR_INFO.email && (
                <a
                  href={`mailto:${AUTHOR_INFO.email}`}
                  className="flex items-center gap-2.5 text-sm text-foreground hover:text-primary transition-colors"
                >
                  <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                  {AUTHOR_INFO.email}
                </a>
              )}
              {AUTHOR_INFO.phone && (
                <a
                  href={`tel:${AUTHOR_INFO.phone}`}
                  className="flex items-center gap-2.5 text-sm text-foreground hover:text-primary transition-colors"
                >
                  <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                  {AUTHOR_INFO.phone}
                </a>
              )}
              {AUTHOR_INFO.github && (
                <a
                  href={AUTHOR_INFO.github}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2.5 text-sm text-foreground hover:text-primary transition-colors"
                >
                  <Github className="h-4 w-4 text-muted-foreground shrink-0" />
                  {AUTHOR_INFO.github}
                  <ExternalLink className="h-3 w-3 text-muted-foreground" />
                </a>
              )}
              {AUTHOR_INFO.linkedin && (
                <a
                  href={AUTHOR_INFO.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2.5 text-sm text-foreground hover:text-primary transition-colors"
                >
                  <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
                  {AUTHOR_INFO.linkedin}
                  <ExternalLink className="h-3 w-3 text-muted-foreground" />
                </a>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Features */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">ฟีเจอร์หลัก</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2">
            {FEATURES.map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-2.5 rounded-lg border border-border/50 bg-muted/30 px-3 py-2.5">
                <Icon className="h-4 w-4 text-emerald-600 shrink-0" />
                <span className="text-sm text-foreground">{label}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Tech stack */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">เทคโนโลยีที่ใช้</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {TECH_STACK.map(({ category, items }) => (
              <div key={category} className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{category}</p>
                <div className="flex flex-wrap gap-1.5">
                  {items.map((item) => (
                    <Badge key={item} variant="secondary" className="text-xs font-normal">
                      {item}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium text-foreground truncate">{value}</p>
      </div>
    </div>
  )
}
