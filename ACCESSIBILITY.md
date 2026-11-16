# Accessibility Statement for Walkscope

Walkscope is committed to ensuring pedestrian navigation and route context intelligence are accessible to everyone, including people with visual, motor, cognitive, and hearing impairments.

---

## 1. Accessibility Standards & Principles

Walkscope strives to align with the **Web Content Accessibility Guidelines (WCAG) 2.1 Level AA** standards and mobile platform accessibility guidelines (Android Accessibility and Apple Human Interface Guidelines for Accessibility).

Our user experience follows four core accessibility pillars:

1. **Perceivable**: High-contrast typography, glanceable iconography, and descriptive text alternatives for non-text content.
2. **Operable**: Ergonomic one-handed thumb-zone controls, large touch targets, and full screen reader navigation.
3. **Understandable**: Clear, jargon-free pedestrian instructions, explicit disclosures of data limitations, and consistent layouts.
4. **Robust**: Fully compatible with native assistive technologies (Google TalkBack on Android and Apple VoiceOver on iOS).

---

## 2. Key Accessibility Features

### High-Contrast OLED Visual Design
- Designed with high-contrast color palettes optimized for outdoor sunlight legibility and low-light night walking.
- Deep dark slate backgrounds (`#090D16` / `#0F172A`) paired with bright foreground text (`#F8FAFC` / `#FFFFFF`) providing a contrast ratio exceeding **7:1**, well above WCAG AA requirements.
- Status badges and warnings utilize dual visual indicators (both color and distinct iconography, such as ⚠️, ●, 🏁) so information is never conveyed by color alone.

### Screen Reader Support (TalkBack & VoiceOver)
- Every interactive element (buttons, cards, search bars, tabs) implements semantic React Native accessibility props:
  - `accessible={true}`
  - `accessibilityRole="button"` / `"header"` / `"tab"`
  - Descriptive `accessibilityLabel` (e.g., *"Open map to find a walking route"*, *"Previous maneuver step"*, *"Emergency speed dial 112"*)
- Maneuver step directions and turn instructions are structured as readable strings rather than arbitrary symbols, ensuring screen readers announce maneuvers accurately (e.g., *"Turn left onto Brigade Road in 45 meters"*).

### Giant Maneuver HUD (Glanceable Navigation)
- Live turn-by-turn navigation features a prominent high-contrast Heads-Up Display (HUD) with high-visibility maneuver arrows and large typography, allowing users with low vision or varying mobility to read directions at a glance without straining.

### Touch Target Sizing & Thumb-Zone Ergonomics
- Interactive buttons and sheet handles adhere to Android Material and Apple HIG touch target guidelines with minimum dimensions of **$48 \times 48\text{dp}$**.
- Essential actions (route comparison, navigation start, emergency speed dial) are concentrated in the bottom thumb zone to enable comfortable one-handed operation.

### Accessible Emergency Speed Dial
- The emergency speed dial (`112`) includes a clear, accessible confirmation dialog. It explicitly informs assistive technology users that the device's native dialer will be launched with the number pre-filled, preventing unexpected silent calls.

---

## 3. Supported Environments & Assistive Technologies

Walkscope is designed and tested for:
- **Android 10+ (API 29 to 35)** with Google TalkBack and Switch Access
- **iOS 16+** with Apple VoiceOver and Voice Control
- System-level display settings including:
  - Font scaling and large text settings
  - High contrast text modes
  - Dark mode / system theme synchronization

---

## 4. Known Limitations & Ongoing Improvements

While we strive for comprehensive accessibility, some areas are actively being enhanced:
- **Map Cartography**: Visual raster/vector map tiles convey complex spatial relationships that can be challenging for screen readers to describe comprehensively. To mitigate this, **all essential turn-by-turn guidance, venue statuses, and corridor metrics are simultaneously exposed as accessible text cards and lists** in the bottom sheet and maneuver HUD.
- **Third-Party Street Photography**: Street-level imagery retrieved from Panoramax does not currently include automated alt-text descriptions for photographic scene details; capture timestamps, provider attribution, and distance metadata are announced instead.

---

## 5. Feedback & Reporting Barriers

We welcome feedback on the accessibility of Walkscope. If you encounter any accessibility barriers or have suggestions for improvement, please contact us:

- **Email**: [koushikkatkam@gmail.com](mailto:koushikkatkam@gmail.com)
- **Subject**: `[A11Y] Walkscope Accessibility Feedback`
- **GitHub**: Open an issue using our [Bug Report](.github/ISSUE_TEMPLATE/bug_report.md) template with the `accessibility` label.

We aim to respond to accessibility reports within **48 hours** and prioritize barrier resolution in upcoming releases.
