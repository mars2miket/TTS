HOW TO ADD A NEW LANGUAGE TO RECALLRX
│
├── 1. FILE STRUCTURE
│   ├── js/locales/en.js       ← English dictionary
│   ├── js/locales/vi.js       ← Vietnamese dictionary
│   ├── js/locales/<code>.js   ← NEW language goes here
│   └── js/i18n.js             ← engine (rarely needs edits)
│
├── 2. DICTIONARY FORMAT (each locale file)
│   ├── window.__LOCALES__ = window.__LOCALES__ || {};
│   └── window.__LOCALES__.<code> = { key: "translated string", ... };
│       └── Keys must match en.js exactly — only values change
│
├── 3. THREE WAYS STRINGS GET TRANSLATED
│   │
│   ├── A) Static HTML elements
│   │   ├── Attribute on element: data-i18n="key"
│   │   ├── Variants: data-i18n-title, data-i18n-aria, data-i18n-placeholder
│   │   ├── Engine walks DOM on language change and swaps the value
│   │   └── RULE: never put data-i18n on an element with child elements
│   │       (textContent replacement wipes them) — wrap label in its own span
│   │
│   ├── B) JS-generated strings (exam module, dynamic UI)
│   │   ├── Call t('key') wherever the string is needed
│   │   ├── t() defined at top of exam.js:
│   │   │   function t(key) {
│   │   │       return (window.__i18n__ && window.__i18n__.t)
│   │   │           ? window.__i18n__.t(key) : key;
│   │   │   }
│   │   └── RULE: hardcoded English strings in JS must be replaced with t('...')
│   │
│   └── C) CSS-generated content (::before / ::after)
│       └── NEVER USE content: "text" — it's untranslatable
│           Move the string into HTML with data-i18n instead
│
├── 4. LANGUAGE CHANGE FLOW
│   ├── User clicks #lang-toggle
│   ├── i18n.js cycles to next code in window.__LOCALES__
│   ├── apply(lang) runs:
│   │   ├── Sets <html lang> and <html data-lang>
│   │   ├── Walks DOM for data-i18n* attributes and swaps values
│   │   ├── Saves to localStorage['recallrx-lang']
│   │   └── Calls window.refreshExamLanguage() if it exists
│   └── Page is now in the new language, no refresh needed
│
├── 5. THE EXAM MODULE (special case)
│   ├── Exam shell is rebuilt entirely on language change
│   ├── exam.js exposes two functions for i18n.js to call:
│   │   ├── window.renderShell()           ← builds an empty shell
│   │   └── window.refreshExamLanguage()   ← smart: re-renders active
│   │       question if one exists, else empty shell
│   │
│   ├── PROBLEM: elements built once and never re-rendered
│   │   (Exam Prompt label, Check Answer, Next buttons) stayed stale
│   │
│   ├── SOLUTION: refreshShellChrome(wrapper) helper
│   │   └── Re-applies t() to those persistent elements
│   │       Called by BOTH renderShell() and drawActiveQuestion()
│   │
│   └── RULE: if a shell element is created in buildShell() but NOT
│       touched by drawActiveQuestion(), it must be refreshed in
│       refreshShellChrome() — otherwise it stays stale until reload
│
├── 6. INITIALIZATION ORDER (in index.html)
│   ├── <head> script: reads localStorage, sets <html data-theme> and lang
│   │   BEFORE paint (avoids flash of wrong theme/language)
│   ├── <script src="js/locales/en.js">       ← locales first
│   ├── <script src="js/locales/vi.js">
│   ├── <script src="js/locales/<new>.js">    ← new locale goes here
│   ├── <script src="js/i18n.js">             ← engine after locales
│   ├── <script src="js/app.js">
│   ├── <script src="js/exam.js">             ← exposes refresh funcs
│   └── ... rest of JS files
│
├── 7. WHEN ADDING A NEW KEY (step by step)
│   ├── 1. Add key to en.js with English value
│   ├── 2. Add same key to vi.js with Vietnamese value
│   ├── 3. If the string is in static HTML → add data-i18n="key" attribute
│   ├── 4. If the string is generated in JS → replace literal with t('key')
│   └── 5. If the string is in CSS content: → move to HTML with data-i18n
│
├── 8. KNOWN UNTRANSLATED (future work)
│   ├── Confirm modal (Are you sure? / Cancel / Confirm)
│   ├── Native alert() and prompt() dialogs
│   └── Voice names from Web Speech API (OS-provided)
│
└── 9. WHAT NOT TO DO
    ├── ✗ Hardcode English text in JS without t('...')
    ├── ✗ Use CSS content: "..." for user-visible strings
    ├── ✗ Put data-i18n on an element that contains child markup
    ├── ✗ Rename an existing key (change the value, not the key)
    ├── ✗ Load a locale script AFTER i18n.js
    └── ✗ Forget to add the key to every locale file (falls back to
        first locale's value, or shows the raw key name)