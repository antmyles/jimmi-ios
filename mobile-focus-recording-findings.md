# Mobile focused-composer recording findings

The uploaded screen recording is 1180 × 2556 HEVC video, approximately 11.76 seconds long. Extracted frames show the page opened in an in-app/mobile browser chrome, with the browser URL and floating bottom controls visible.

Frame 001 shows the chat page already horizontally offset: the left side of the header/logo is clipped and the right profile avatar is partly off-screen. This indicates the document or a major chat shell is wider than the visual viewport even before the keyboard/focused input state is fully visible.

Frame 006 shows the chat composer focused with text entered. A visible horizontal scroll indicator/edge line appears near the lower viewport, and the send button/control is partially clipped on the right edge. The chat shell appears wider than the viewport, suggesting that one of the focused composer wrappers, fixed/sticky bottom controls, or min-width/flex descendants still contributes to a scrollable width during mobile focus.

The browser likely exposes the problem because mobile browser chrome and keyboard focus change the visual viewport, but the root cause should still be fixed in the app by constraining root, shell, and composer descendants to max-width: 100%, min-width: 0, and safe-area-aware inline spacing without 100vw-style expansion.
