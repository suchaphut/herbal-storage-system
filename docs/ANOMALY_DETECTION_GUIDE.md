# คู่มือการใช้งาน Advanced Anomaly Detection

## ภาพรวม

ระบบ Anomaly Detection ได้รับการปรับปรุงให้มีประสิทธิภาพสูงขึ้นด้วยการเพิ่ม Machine Learning models ขั้นสูง 3 แบบ:

1. **Isolation Forest** - เร็ว, เหมาะกับข้อมูลน้อย
2. **LSTM Autoencoder** - ตรวจจับ pattern ซับซ้อน, sequence-aware
3. **One-Class SVM** - Robust, hyperparameter tuning อัตโนมัติ
4. **Ensemble Detector** - รวม 3 โมเดล, ประสิทธิภาพสูงสุด

---

## การเลือกใช้โมเดล

### Isolation Forest
**เหมาะกับ:**
- ข้อมูลน้อย (< 20 จุด)
- ต้องการความเร็ว
- Pattern ไม่ซับซ้อน

**ข้อดี:**
- เร็วมาก (< 1 วินาที)
- ไม่ต้องการข้อมูลมาก
- ใช้ memory น้อย

**ข้อเสีย:**
- อาจพลาด pattern ที่ซับซ้อน
- ไม่คำนึงถึง sequence/time order

### LSTM Autoencoder
**เหมาะกับ:**
- ข้อมูลมาก (> 50 จุด)
- Pattern ซับซ้อนที่เปลี่ยนแปลงตามเวลา
- ต้องการความแม่นยำสูง

**ข้อดี:**
- ตรวจจับ pattern ซับซ้อนได้ดีมาก
- Sequence-aware (คำนึงถึงลำดับเวลา)
- เรียนรู้ normal behavior อัตโนมัติ

**ข้อเสีย:**
- ช้า (training 30-120 วินาที)
- ต้องการข้อมูลมาก (> 12 จุด)
- ต้องติดตั้ง TensorFlow

### One-Class SVM
**เหมาะกับ:**
- ข้อมูลปานกลาง (10-100 จุด)
- ต้องการ robustness
- มี outliers ในข้อมูล training

**ข้อดี:**
- Robust ต่อ outliers
- Hyperparameter tuning อัตโนมัติ
- ทำงานดีกับข้อมูลหลากหลาย

**ข้อเสีย:**
- ช้ากว่า Isolation Forest
- ต้องการข้อมูลอย่างน้อย 10 จุด

### Ensemble Detector (แนะนำ)
**เหมาะกับ:**
- ทุกกรณี (ถ้ามีเวลา)
- ต้องการความแม่นยำสูงสุด
- ข้อมูลมาก (> 20 จุด)

**ข้อดี:**
- ประสิทธิภาพสูงสุด
- รวมจุดแข็งของทั้ง 3 โมเดล
- Adaptive weighting ตามขนาดข้อมูล
- Multi-model consensus

**ข้อเสีย:**
- ช้าที่สุด (รัน 3 models)
- ต้องติดตั้ง dependencies ครบ

---

## การติดตั้ง

### 1. ติดตั้ง Python Dependencies

```bash
# ติดตั้งแบบพื้นฐาน (Isolation Forest + One-Class SVM)
pip install -r scripts/requirements-ml.txt

# สำหรับ LSTM Autoencoder (optional)
pip install tensorflow>=2.13.0
```

### 2. ตั้งค่า Environment Variables

ใน `.env.local`:

```env
# เปิดใช้ Python ML
ENABLE_PYTHON_ML=1

# (Optional) ใช้ Ensemble Detector แทน Isolation Forest เดี่ยว
USE_ENSEMBLE_ANOMALY=1

# (Optional) ถ้า Python ไม่ได้อยู่ใน PATH
PYTHON_PATH=/usr/bin/python3
```

---

## การใช้งานผ่าน API

### TypeScript/JavaScript

```typescript
import { 
  runIsolationForest, 
  runLSTMAutoencoder, 
  runOneClassSVM, 
  runEnsembleAnomaly 
} from '@/lib/ml-python-bridge'

// ข้อมูล input
const data = [
  [25.5, 60.2], // [temperature, humidity]
  [26.1, 61.5],
  [25.8, 59.8],
  // ... more data points
]

// 1. Isolation Forest (เร็ว)
const ifResult = await runIsolationForest({
  data,
  contamination: 0.05,
  feature_set: 'environmental'
})

// 2. LSTM Autoencoder (ต้องมีข้อมูล > 12 จุด)
const lstmResult = await runLSTMAutoencoder({
  data,
  contamination: 0.05,
  feature_set: 'environmental',
  sequence_length: 10,
  train_new: false // ใช้ cached model ถ้ามี
})

// 3. One-Class SVM
const svmResult = await runOneClassSVM({
  data,
  contamination: 0.05,
  feature_set: 'environmental',
  kernel: 'rbf',
  auto_tune: true
})

// 4. Ensemble (แนะนำ)
const ensembleResult = await runEnsembleAnomaly({
  data,
  contamination: 0.05,
  feature_set: 'environmental',
  weights: {
    isolation_forest: 0.4,
    lstm_autoencoder: 0.35,
    one_class_svm: 0.25
  }
})

// ผลลัพธ์
console.log(ensembleResult.scores)      // [0.1, 0.2, 0.95, ...]
console.log(ensembleResult.labels)      // [1, 1, -1, ...] (1=normal, -1=anomaly)
console.log(ensembleResult.severities)  // [{level: 'normal', score: 0}, ...]
console.log(ensembleResult.meta)        // metadata, models_used, weights
```

### Python (Command Line)

```bash
# Isolation Forest
echo '{"data":[[25,55],[26,56],[30,80]],"contamination":0.05,"feature_set":"environmental"}' | \
  python scripts/ml_isolation_forest.py

# LSTM Autoencoder
echo '{"data":[[25,55],[26,56],[27,57],[25,54],[26,55],[27,56],[25,55],[26,56],[27,57],[25,54],[26,55],[27,56]],"contamination":0.05,"feature_set":"environmental"}' | \
  python scripts/ml_lstm_autoencoder.py

# One-Class SVM
echo '{"data":[[25,55],[26,56],[30,80]],"contamination":0.05,"feature_set":"environmental","auto_tune":true}' | \
  python scripts/ml_ocsvm.py

# Ensemble
echo '{"data":[[25,55],[26,56],[30,80]],"contamination":0.05,"feature_set":"environmental"}' | \
  python scripts/ml_ensemble_anomaly.py
```

---

## Output Format

ทุกโมเดลจะคืนค่าในรูปแบบเดียวกัน:

```json
{
  "scores": [0.1, 0.2, 0.95],
  "labels": [1, 1, -1],
  "severities": [
    {
      "level": "normal",
      "score": 0,
      "explanation": null
    },
    {
      "level": "normal",
      "score": 0,
      "explanation": null
    },
    {
      "level": "critical",
      "score": 4,
      "explanation": {
        "model": "isolation_forest",
        "explanation": {
          "main_feature": "temperature",
          "deviation": 2.5,
          "description": "temperature is irregular"
        }
      }
    }
  ],
  "meta": {
    "model": "ensemble",
    "models_used": ["isolation_forest", "lstm_autoencoder", "one_class_svm"],
    "weights": {...},
    "n_anomalies": 1
  }
}
```

### Severity Levels

- **normal** (0) - ค่าปกติ
- **low** (1) - ผิดปกติเล็กน้อย
- **medium** (2) - ผิดปกติปานกลาง
- **high** (3) - ผิดปกติมาก
- **critical** (4) - ผิดปกติร้ายแรง ต้องดำเนินการทันที

---

## Performance Comparison

| โมเดล | ความเร็ว | ข้อมูลขั้นต่ำ | Accuracy | Use Case |
|-------|---------|--------------|----------|----------|
| Isolation Forest | ⚡⚡⚡ | 2 จุด | ⭐⭐⭐ | Real-time, ข้อมูลน้อย |
| LSTM Autoencoder | ⚡ | 12 จุด | ⭐⭐⭐⭐⭐ | Complex patterns, ข้อมูลมาก |
| One-Class SVM | ⚡⚡ | 10 จุด | ⭐⭐⭐⭐ | Robust detection, ข้อมูลปานกลาง |
| Ensemble | ⚡ | 20 จุด | ⭐⭐⭐⭐⭐ | Best accuracy, production |

---

## Best Practices

### 1. เลือกโมเดลตามขนาดข้อมูล
- **< 10 จุด**: Isolation Forest
- **10-50 จุด**: One-Class SVM หรือ Isolation Forest
- **> 50 จุด**: Ensemble (ถ้ามีเวลา) หรือ LSTM Autoencoder

### 2. ปรับ Contamination Rate
- **0.01-0.03**: ข้อมูลคุณภาพสูง, anomaly น้อย
- **0.05**: Default, เหมาะกับส่วนใหญ่
- **0.1-0.2**: ข้อมูลมี noise มาก

### 3. Model Caching
- LSTM และ One-Class SVM จะ cache model อัตโนมัติ
- ใช้ `train_new: false` เพื่อใช้ cached model (เร็วกว่า)
- Cache จะถูกเก็บใน `ml_models/` folder

### 4. Feature Set
- `environmental`: temperature, humidity
- `power`: current, power

### 5. Monitoring
- ตรวจสอบ `meta.n_anomalies` เพื่อดูจำนวน anomalies
- ใช้ `severities[].explanations` เพื่อเข้าใจสาเหตุ
- สำหรับ Ensemble, ดู `meta.individual_results` เพื่อเปรียบเทียบโมเดล

---

## Troubleshooting

### TensorFlow ไม่ติดตั้ง
LSTM Autoencoder จะถูกข้าม, Ensemble จะใช้แค่ IF + SVM

### Model ช้าเกินไป
- ลด `sequence_length` สำหรับ LSTM
- ปิด `auto_tune` สำหรับ SVM
- ใช้ Isolation Forest แทน Ensemble

### Accuracy ต่ำ
- เพิ่มข้อมูล training
- ปรับ `contamination` rate
- ลองใช้ Ensemble แทนโมเดลเดี่ยว
- ตรวจสอบคุณภาพข้อมูล (outliers, missing values)

### Memory Error
- ลดขนาดข้อมูล
- ใช้ Isolation Forest แทน LSTM
- เพิ่ม RAM หรือใช้ smaller batch size

---

## ตัวอย่างการใช้งานจริง

### ตรวจจับอุณหภูมิผิดปกติในห้องเก็บสมุนไพร

```typescript
import { runEnsembleAnomaly } from '@/lib/ml-python-bridge'

async function detectTemperatureAnomaly(roomId: string) {
  // ดึงข้อมูล 24 ชั่วโมงล่าสุด
  const readings = await getEnvironmentalReadings(roomId, 24 * 60)
  
  const data = readings.map(r => [r.temperature, r.humidity])
  
  const result = await runEnsembleAnomaly({
    data,
    contamination: 0.05,
    feature_set: 'environmental'
  })
  
  // หา anomalies ที่ severity >= medium
  const criticalAnomalies = result.severities
    .map((sev, idx) => ({ ...sev, index: idx, reading: readings[idx] }))
    .filter(item => item.score >= 2)
  
  if (criticalAnomalies.length > 0) {
    // สร้าง alert
    await createAlert({
      roomId,
      type: 'TEMPERATURE_ANOMALY',
      severity: Math.max(...criticalAnomalies.map(a => a.score)),
      details: criticalAnomalies,
      message: `Detected ${criticalAnomalies.length} temperature anomalies`
    })
  }
  
  return result
}
```

---

## สรุป

Advanced Anomaly Detection ช่วยเพิ่มประสิทธิภาพการตรวจจับความผิดปกติได้อย่างมาก:

✅ **Ensemble Detector** ให้ความแม่นยำสูงสุด  
✅ **LSTM Autoencoder** ตรวจจับ pattern ซับซ้อนได้  
✅ **One-Class SVM** robust ต่อ outliers  
✅ **Multi-level Severity** ช่วยจัดลำดับความสำคัญ  
✅ **Feature Explanation** ช่วยเข้าใจสาเหตุ  

สำหรับ production แนะนำให้ใช้ **Ensemble Detector** เพื่อความแม่นยำสูงสุด
