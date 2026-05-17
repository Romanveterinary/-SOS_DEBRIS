ПРОЄКТ ЦИВІЛЬНОЇ БЕЗПЕКИ SOS DEBRIS. КОД ПОВНІСТЮ БЕЗКОШТОВНИЙ ТА ВІДКРИТИЙ ДЛЯ ІНТЕГРАЦІЇ В МІСЬКІ СИСТЕМИ ТА СИСТЕМИ ДСНС
# SOS DEBRIS (CIVILIAN RESCUE ARCHITECTURE)
### Open-Source Autonomous Life-Saving System for Structural Collapses

SOS DEBRIS is an uncompromised, zero-dependency mobile application built strictly for tactical civilian survival under structural debris caused by missile strikes or drone attacks. It bypasses web sandbox restrictions by communicating directly with the native Android OS kernel to ensure delivery of life-saving telemetry when every second counts.

---

## 🛠️ CRITICAL ARCHITECTURAL FEATS

1. **Native GPS/Network Hard-Link Bridge:** Bypasses Android's default power-saving geolocation throttling. Forcibly queries cell towers and satellite arrays simultaneously via a dedicated native Java bridge (`MainActivity.java`).
2. **Tactical Beacon System:** Emits high-frequency dual-tone acoustics (1800Hz - 3800Hz) combined with rapid hardware-level camera flash strobe cycles. Optimized for urban search-and-rescue canine teams and thermal/acoustic sensors.
3. **Smart PPG Photoplethysmography (Palmar Triage):** Custom software-defined analysis of capillary blood volume changes using a multi-camera array and hardware flash. Allows victims to register pulse rate and respiration difficulty (Triage status) even in complete darkness.
4. **Smart Ultra-Low Battery Conservation (ECO-Beacon):** Automatically triggers after 5 minutes of intensive alert. Shifts into a deep-sleep cycle, waking up every 3 minutes for a 3-second maximum-intensity sensory pulse, extending phone battery life up to 48-72 hours under rubble.
5. **Fail-Safe Application Termination:** Hardwired "Stop" function that completely releases all hardware wake-locks, camera tracks, and audio context instances, guaranteeing absolute data and battery privacy instantly upon execution.

---

## 💾 CODEBASE & DEPLOYMENT SPECS

* **Core Engine:** HTML5 / CSS3 (Amoled Black Minimalist UI) / Native EcmaScript 6
* **Mobile Runtime:** Capacitor v5 (Hybrid Native Wrapper Engine)
* **Native Overrides:** Java Android Bridge Core (`BridgeActivity`)
* **Hardware Permissions:** `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`, `CAMERA`, `VIBRATE`, `WAKE_LOCK`
* **Distribution Format:** Independent `.apk` (Zero external registry reliance, side-loadable in communication blackouts)
