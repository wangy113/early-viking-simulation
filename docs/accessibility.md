# Accessibility

The goal is WCAG 2.1 level AA, which is also what Quality Matters Standard 8 asks for. This page lists what the app does, what the automated tests check, and the checks a person still needs to do.

## What the app does

- Every control is a visible button. Keys only duplicate buttons (arrow keys and W A S D move, Escape closes).
- The Text version holds the full content of every stop, plus a description of the scene. It is the equal alternative to the 3D view, which a screen reader cannot describe.
- The All stops list reaches any stop with the keyboard or a screen reader, without using the 3D scene.
- Dialogs are native HTML dialogs. They keep focus inside, close with Escape, and return focus to the button that opened them.
- When a stop opens, focus moves to its title. Closing the stop returns focus to where it was.
- Pause motion stops the moving people, sea, smoke and birds (WCAG 2.2.2). If the device asks for reduced motion, motion starts paused and camera moves jump instead of fly.
- Focus is always visible as a blue outline.
- On phones the tools fold into a Menu button and a stop opens as a sheet at the bottom. Nothing scrolls sideways at 320 pixels wide. Touch targets are at least 44 pixels. Two fingers pinch to walk.
- No login, tracking, cookies or third-party requests.

## Automated checks

`tests/a11y.spec.js` runs with the other Playwright tests:

- axe-core finds no WCAG 2.1 A or AA problems in the welcome dialog, an open stop, the stop list and the Text version.
- A keyboard-only path: start, open All stops, choose stop 3, close it, open and close the Text version, with focus checked at each step.
- Pause motion toggles, and starts paused under reduced motion.
- At 320 by 640 pixels on a touch device: no sideways scroll, the Menu holds the tools, and every visible button is at least 44 pixels.

## Checks for a person

Automated tools catch about a third of real problems. Before release, someone should check:

- [ ] NVDA with Firefox or Chrome on Windows: the welcome dialog is read, the stop list is announced as a list of buttons, a stop's title is read when it opens, and the Text version reads in a sensible order.
- [ ] VoiceOver with Safari on a Mac and on an iPhone: the same as above, and the Menu button announces expanded and collapsed.
- [ ] Keyboard only, in Canvas: Tab reaches every button in a sensible order and focus never gets lost behind a dialog.
- [ ] 200% browser zoom on a laptop: all text is readable and no buttons overlap.
- [ ] Windows High Contrast mode: buttons and focus outlines stay visible.
- [ ] Reduced motion turned on in the operating system: motion starts paused.
- [ ] A Chromebook and a phone: the scene runs smoothly enough to use, and the Quality button helps if it does not.

Record the date, device, browser and result of each check here.
