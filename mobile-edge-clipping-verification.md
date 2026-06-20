# Mobile Edge-Clipping Verification

After applying the chat containment fix, the provided preview URL opened directly to `/chat`. The visible JIMMI chat shell, header wordmark, member avatar, message card, orb, and composer were inside the page bounds in the live preview. A DOM width measurement returned equal viewport and scroll widths:

| Metric | Value |
| --- | ---: |
| `window.innerWidth` | 1280 |
| `document.documentElement.clientWidth` | 1280 |
| `document.documentElement.scrollWidth` | 1280 |
| `document.body.clientWidth` | 1280 |
| `document.body.scrollWidth` | 1280 |
| `#root.clientWidth` | 1280 |
| `#root.scrollWidth` | 1280 |
| Horizontal overflow detected | false |

The browser screenshot for this verification was saved at `/home/ubuntu/screenshots/3000-iz56td8debyi7s4_2026-05-10_09-40-59_4718.webp`.
